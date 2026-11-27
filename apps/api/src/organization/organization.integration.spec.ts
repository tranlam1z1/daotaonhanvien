import 'reflect-metadata';
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';
import request from 'supertest';
import { AppModule } from '../app.module';
import { webOrigin } from '../auth/auth-policy';
import { LeadInfrastructure } from '../leads/leads.infrastructure';
import {
  createTenantFixture,
  removeTenantFixture,
} from '../testing/tenant-fixture';

const integration =
  process.env.TENANT_INTEGRATION_TEST === 'true' ? describe : describe.skip;
const password = 'TestPassword36!';
const active = { name: 'Kinh doanh', status: 'ACTIVE' };

integration('T08 organization management', () => {
  const root = new PrismaClient();
  let app: INestApplication;
  let own: Awaited<ReturnType<typeof createTenantFixture>>;
  let other: typeof own;
  let admin: string;
  let manager: string;
  let employee: string;
  let planId: string | undefined;

  function api(
    method: 'get' | 'post' | 'patch' | 'delete',
    route = '',
    cookie = admin,
  ) {
    return request(app.getHttpServer())
      [method]('/organization' + route)
      .set('Origin', webOrigin())
      .set('Cookie', cookie);
  }

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', webOrigin())
      .send({ identifier: email, password })
      .expect(204);
    return response.headers['set-cookie'][0].split(';')[0] as string;
  }

  beforeAll(async () => {
    const passwordHash = await hash(password);
    own = await createTenantFixture(root, passwordHash);
    other = await createTenantFixture(root, passwordHash);
    await root.userRole.create({
      data: { tenantId: own.tenantId, userId: own.users[1].id, role: 'PTDT' },
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LeadInfrastructure)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    await app.init();
    admin = await login(own.users[0].email);
    manager = await login(own.users[1].email);
    employee = await login(own.users[2].email);
  });

  afterAll(async () => {
    try {
      if (own) await removeTenantFixture(root, own.tenantId);
      if (other) await removeTenantFixture(root, other.tenantId);
      if (planId) await root.plan.delete({ where: { id: planId } });
    } finally {
      await app?.close();
      await root.$disconnect();
    }
  });

  it('isolates the dashboard and every mutation from other tenant identifiers', async () => {
    const foreign = other.tenantId;
    const tenantBefore = await root.tenant.findUnique({
      where: { id: foreign },
    });
    const dashboard = await api('get', '?tenantId=' + foreign).expect(200);
    expect(dashboard.body.profile.name).not.toBe(tenantBefore?.name);
    expect(
      dashboard.body.departments.map(({ id }: { id: string }) => id),
    ).toEqual([own.department.id]);
    expect(
      dashboard.body.positions.map(({ id }: { id: string }) => id),
    ).toEqual([own.position.id]);
    await api('patch', '/profile')
      .send({ name: 'Chỉ sửa công ty A', tenantId: foreign })
      .expect(200);
    await api('patch', '/config')
      .send({ tenantId: foreign, reminderDays: 1 })
      .expect(200);
    await api('post', '/departments')
      .send({ ...active, tenantId: foreign, parentId: other.department.id })
      .expect(400);
    const department = await api('post', '/departments')
      .send({ ...active, tenantId: foreign })
      .expect(201);
    await api('patch', '/departments/' + other.department.id)
      .send(active)
      .expect(404);
    await api('patch', '/departments/' + department.body.id)
      .send({ ...active, parentId: other.department.id })
      .expect(400);
    const position = await api('post', '/positions')
      .send({ ...active, tenantId: foreign })
      .expect(201);
    await api('patch', '/positions/' + other.position.id)
      .send(active)
      .expect(404);
    expect(await root.tenant.findUnique({ where: { id: foreign } })).toEqual(
      tenantBefore,
    );
    expect(
      await root.department.findMany({ where: { tenantId: foreign } }),
    ).toEqual([other.department]);
    expect(
      await root.position.findMany({ where: { tenantId: foreign } }),
    ).toEqual([other.position]);
    expect(
      await root.department.findUnique({ where: { id: department.body.id } }),
    ).toMatchObject({ tenantId: own.tenantId });
    expect(
      await root.position.findUnique({ where: { id: position.body.id } }),
    ).toMatchObject({ tenantId: own.tenantId });
  });

  it('enforces session, read-only roles and write origin', async () => {
    await api('get', '', '').expect(401);
    await api('get', '', employee).expect(403);
    await api('get', '', manager).expect(200);
    const writes = [
      ['patch', '/profile'],
      ['patch', '/config'],
      ['post', '/departments'],
      ['patch', '/departments/' + own.department.id],
      ['post', '/positions'],
      ['patch', '/positions/' + own.position.id],
    ] as const;
    for (const [method, path] of writes)
      await api(method, path, manager).send(active).expect(403);
    await api('patch', '/profile')
      .set('Origin', 'https://outside.example')
      .send(active)
      .expect(403);
  });

  it('saves the full profile and validates logo URLs', async () => {
    const profile = {
      name: '<strong>EduCore36</strong>',
      logo: 'https://example.test/logo.png',
      taxCode: '0123456789',
      address: 'Thanh Hóa',
      contactName: 'Nguyễn An',
      contactPhone: '0912345678',
    };
    await api('patch', '/profile').send(profile).expect(200).expect(profile);
    await api('patch', '/profile')
      .send({ ...profile, logo: 'javascript:alert(1)' })
      .expect(400);
    expect((await api('get').expect(200)).body.profile).toEqual(profile);
  });

  it('round-trips D-05 and BR-012 settings and validates input', async () => {
    await root.tenant.update({
      where: { id: own.tenantId },
      data: { config: { retained: true, completion: { retained: true } } },
    });
    const defaults = {
      selfApproval: false,
      reminderDays: 0,
      handoverDays: null,
      completion: {
        lessonRequired: true,
        lessonPercent: 100,
        finalScoreRequired: true,
        finalScorePercent: 70,
        attemptLimitEnabled: true,
        maxAttempts: 3,
        practiceRequired: false,
      },
    };
    expect((await api('get').expect(200)).body.config).toEqual(defaults);
    const updated = {
      selfApproval: true,
      reminderDays: 3,
      handoverDays: 10,
      completion: {
        lessonRequired: false,
        lessonPercent: 85,
        finalScoreRequired: false,
        finalScorePercent: 80,
        attemptLimitEnabled: false,
        maxAttempts: 5,
        practiceRequired: true,
      },
    };
    await api('patch', '/config').send(updated).expect(200).expect(updated);
    await api('patch', '/config')
      .send({ completion: { lessonPercent: 101 } })
      .expect(400);
    await api('patch', '/config')
      .send({ completion: { maxAttempts: 0 } })
      .expect(400);
    await api('patch', '/config').send({ reminderDays: '3' }).expect(400);
    await api('patch', '/config').send({ handoverDays: null }).expect(200);
    const persisted = { ...updated, handoverDays: null };
    expect((await api('get').expect(200)).body.config).toEqual(persisted);
    expect(
      (await root.tenant.findUnique({ where: { id: own.tenantId } }))?.config,
    ).toEqual({
      ...persisted,
      retained: true,
      completion: { ...persisted.completion, retained: true },
    });
  });

  it('moves departments and serializes concurrent moves that could create a cycle', async () => {
    const first = await api('post', '/departments')
      .send({ ...active, name: 'Bán hàng' })
      .expect(201);
    const second = await api('post', '/departments')
      .send({ ...active, name: 'Dịch vụ', parentId: first.body.id })
      .expect(201);
    const firstPath = '/departments/' + first.body.id;
    const secondPath = '/departments/' + second.body.id;
    const renamed = await api('patch', secondPath).send(active).expect(200);
    expect(renamed.body.parentId).toBe(first.body.id);
    await api('patch', firstPath)
      .send({ ...active, parentId: second.body.id })
      .expect(409);
    await api('patch', firstPath)
      .send({ ...active, parentId: first.body.id })
      .expect(409);
    const moved = await api('patch', secondPath)
      .send({ ...active, name: 'Dịch vụ mới', parentId: '' })
      .expect(200);
    expect(moved.body).toMatchObject({ name: 'Dịch vụ mới', parentId: null });
    const results = await Promise.all([
      api('patch', firstPath).send({ ...active, parentId: second.body.id }),
      api('patch', secondPath).send({ ...active, parentId: first.body.id }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
  });

  it('keeps referenced departments and positions when they stop being used', async () => {
    for (const [route, id] of [
      ['departments', own.department.id],
      ['positions', own.position.id],
    ]) {
      await api('delete', '/' + route + '/' + id).expect(404);
      await api('patch', '/' + route + '/' + id)
        .send({ name: 'Danh mục lưu trữ', status: 'INACTIVE' })
        .expect(200);
      const data = (await api('get').expect(200)).body[route];
      expect(data).toContainEqual(
        expect.objectContaining({
          id,
          name: 'Danh mục lưu trữ',
          status: 'INACTIVE',
        }),
      );
    }
    await api('post', '/departments')
      .send({ ...active, parentId: own.department.id })
      .expect(400);
    expect(
      await root.user.findUnique({ where: { id: own.users[0].id } }),
    ).toMatchObject({
      departmentId: own.department.id,
      positionId: own.position.id,
    });
  });

  it('reports plan, expiry, live account count and recorded storage', async () => {
    const plan = await root.plan.create({
      data: {
        name: 'Gói thử T08',
        maxAccounts: 50,
        storageGb: 10,
        cycle: 'MONTHLY',
        price: 0,
      },
    });
    planId = plan.id;
    const endsAt = new Date('2028-01-31T16:59:59.999Z');
    await root.subscription.create({
      data: {
        tenantId: own.tenantId,
        planId,
        startsAt: new Date('2028-01-01T00:00:00Z'),
        endsAt,
        billableAccounts: 42,
      },
    });
    await root.tenant.update({
      where: { id: own.tenantId },
      data: { storageUsedBytes: 1234567890n },
    });
    await root.user.update({
      where: { id: own.users[2].id },
      data: { status: 'HANDOVER' },
    });
    expect((await api('get').expect(200)).body.subscription).toEqual({
      plan: {
        endsAt: endsAt.toISOString(),
        plan: { name: plan.name, maxAccounts: 50, storageGb: 10 },
      },
      activeAccounts: 3,
      storageUsedBytes: '1234567890',
    });
    const cookie = await login(other.users[0].email);
    expect(
      (await api('get', '?tenantId=' + own.tenantId, cookie).expect(200)).body
        .subscription,
    ).toEqual({
      plan: null,
      activeAccounts: 3,
      storageUsedBytes: '0',
    });
  });
});
