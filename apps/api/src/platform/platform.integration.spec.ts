import 'reflect-metadata';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, type Tenant } from '@prisma/client';
import { hash } from 'argon2';
import request from 'supertest';
import { AppModule } from '../app.module';
import { AuthMailer } from '../auth/auth-mailer';
import { webOrigin } from '../auth/auth-policy';
import { LeadInfrastructure } from '../leads/leads.infrastructure';
import { TenantDatabase } from '../tenant/tenant-database';
import {
  createTenantFixture,
  removeTenantFixture,
} from '../testing/tenant-fixture';

const integration =
  process.env.TENANT_INTEGRATION_TEST === 'true' ? describe : describe.skip;
const password = 'TestPassword36!';
const companyInput = (suffix = randomUUID()) => ({
  name: 'Doanh nghiệp T07',
  loginCode: 't07-' + suffix,
  contactName: 'Người liên hệ',
  contactPhone: '0912345678',
  taxCode: '0123456789',
  address: 'Thanh Hóa',
  adminName: 'Quản trị đầu tiên',
  adminEmail: 'admin@example.test',
});

integration('T07 platform management and database boundaries', () => {
  const root = new PrismaClient();
  const send = jest
    .fn<Promise<void>, Parameters<AuthMailer['send']>>()
    .mockResolvedValue(undefined);
  const platformId = randomUUID();
  const platformEmail = platformId + '@example.test';
  const tenants = new Set<string>();
  const leadIds = new Set<string>();
  const planIds = new Set<string>();
  let app: INestApplication;
  let a: Awaited<ReturnType<typeof createTenantFixture>>;
  let b: typeof a;
  let platformCookie: string;
  let tenantCookie: string;

  async function login(email: string, companyCode = '') {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', webOrigin())
      .send({ identifier: email, password, companyCode })
      .expect(204);
    return response.headers['set-cookie'][0].split(';')[0] as string;
  }

  function api(
    method: 'get' | 'post' | 'patch',
    path: string,
    cookie = platformCookie,
  ) {
    return request(app.getHttpServer())
      [method]('/platform/' + path)
      .set('Origin', webOrigin())
      .set('Cookie', cookie);
  }

  async function makeLead() {
    const lead = await root.lead.create({
      data: {
        fullName: '<img src=x onerror=alert(1)>',
        jobTitle: 'Quản lý',
        companyName: 'Pilot T07',
        companySize: '30-100',
        phone: '0912345678',
        consent: true,
        ip: '127.0.0.1',
      },
    });
    leadIds.add(lead.id);
    return lead;
  }

  beforeAll(async () => {
    const passwordHash = await hash(password);
    a = await createTenantFixture(root, passwordHash);
    b = await createTenantFixture(root, passwordHash);
    tenants.add(a.tenantId);
    tenants.add(b.tenantId);
    await root.user.create({
      data: {
        id: platformId,
        email: platformEmail,
        fullName: 'Quản trị nền tảng',
        passwordHash,
        status: 'ACTIVE',
        roles: { create: { role: 'QTNT' } },
      },
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthMailer)
      .useValue({ send })
      .overrideProvider(LeadInfrastructure)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    await app.init();
    platformCookie = await login(platformEmail);
    tenantCookie = await login(a.users[0].email);
  });

  afterAll(async () => {
    try {
      await root.lead.deleteMany({ where: { id: { in: [...leadIds] } } });
      for (const id of tenants) await removeTenantFixture(root, id);
      await root.auditLog.deleteMany({ where: { userId: platformId } });
      await root.plan.deleteMany({ where: { id: { in: [...planIds] } } });
      await root.userRole.deleteMany({ where: { userId: platformId } });
      await root.user.deleteMany({ where: { id: platformId } });
    } finally {
      await app?.close();
      await root.$disconnect();
    }
  });

  it('denies tenant A on every T07 endpoint even with tenant B identifiers', async () => {
    const other = b.tenantId;
    const resource = randomUUID();
    const paths: [Parameters<typeof api>[0], string][] = [
      ['get', 'companies'],
      ['post', 'companies'],
      ['patch', 'companies/' + other],
      ['patch', 'companies/' + other + '/status'],
      ['post', 'companies/' + other + '/invitation'],
      ['get', 'plans'],
      ['post', 'plans'],
      ['patch', 'plans/' + resource],
      ['get', 'companies/' + other + '/subscriptions'],
      ['post', 'companies/' + other + '/subscriptions'],
      ['patch', 'companies/' + other + '/subscriptions/' + resource],
      [
        'post',
        'companies/' + other + '/subscriptions/' + resource + '/payments',
      ],
      ['get', 'leads'],
      ['get', 'leads/' + resource],
      ['patch', 'leads/' + resource],
    ];
    for (const [method, path] of paths) {
      const call = api(method, path, tenantCookie);
      if (method !== 'get') call.send({ tenantId: other, status: 'SUSPENDED' });
      await call.expect(403);
    }
    await api('get', 'companies', '').expect(401);
    await api('post', 'companies')
      .set('Origin', 'https://outside.example.test')
      .send(companyInput())
      .expect(403);
    expect(
      await root.tenant.findUnique({
        where: { id: other },
        select: { status: true },
      }),
    ).toEqual({ status: 'ACTIVE' });
  });

  it('exposes company metadata and restricts platform SQL access to business and personal data', async () => {
    const { body } = await api('get', 'companies').expect(200);
    const company = body.find((row: Tenant) => row.id === b.tenantId);
    expect(company).toMatchObject({ id: b.tenantId, status: 'ACTIVE' });
    for (const field of [
      'config',
      'initialAdminId',
      'users',
      'departments',
      'tenantId',
    ]) {
      expect(company).not.toHaveProperty(field);
    }
    const db = app.get(TenantDatabase);
    await expect(
      db.runPlatform(b.tenantId, () =>
        db.client.user.findMany({
          where: { tenantId: b.tenantId },
          select: { id: true, fullName: true },
        }),
      ),
    ).resolves.toEqual([]);
    await expect(
      db.runPlatform(b.tenantId, () => db.client.department.findMany()),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      db.runPlatform(null, () =>
        db.client.user.findMany({ select: { passwordHash: true } }),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('restricts platform totals and staff audit to the platform and returns aggregate data', async () => {
    await api('get', 'summary', tenantCookie).expect(403);
    await api('get', 'audit', tenantCookie).expect(403);
    const summary = await api('get', 'summary', platformCookie).expect(200);
    expect(summary.body).toEqual({
      companies: expect.any(Number),
      activeAccounts: expect.any(Number),
      storageBytes: expect.stringMatching(/^\d+$/),
      expiringSubscriptions: expect.any(Number),
    });
    expect(summary.body.companies).toBeGreaterThanOrEqual(2);
    expect(summary.body.activeAccounts).toBeGreaterThanOrEqual(2);

    const audit = await api('get', 'audit', platformCookie).expect(200);
    expect(audit.body.items).toContainEqual(
      expect.objectContaining({
        action: 'LOGIN',
        user: { fullName: 'Quản trị nền tảng' },
      }),
    );
    expect(
      audit.body.items.every(
        (entry: { user: { fullName: string } | null }) =>
          entry.user?.fullName !== a.users[0].fullName,
      ),
    ).toBe(true);
  });

  it('creates and audits the first ADM, delivers the invite after commit, and enforces suspension', async () => {
    const data = companyInput();
    const created = await api('post', 'companies')
      .send({ ...data, tenantId: b.tenantId })
      .expect(201);
    const id = created.body.id as string;
    tenants.add(id);
    expect(created.body).toEqual({ id, invitationSent: true });
    await api('post', 'companies').send(data).expect(409);
    const admin = await root.user.findFirstOrThrow({
      where: { tenantId: id },
      include: { roles: { select: { role: true } } },
    });
    expect(admin).toMatchObject({
      status: 'PENDING',
      email: data.adminEmail,
      roles: [{ role: 'ADM' }],
    });
    expect(admin.passwordHash).toMatch(/^\$argon2id\$/);
    const token = [...send.mock.calls]
      .reverse()
      .find(([email, kind]) => email === admin.email && kind === 'INVITE')?.[2];
    expect(token).toBeDefined();
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .set('Origin', webOrigin())
      .send({ token, password, mode: 'invite' })
      .expect(204);
    const cookie = await login(admin.email, data.loginCode);

    await api('patch', 'companies/' + id)
      .send({ ...data, name: 'Tên đã sửa' })
      .expect(200);
    await api('patch', 'companies/' + id + '/status')
      .send({ status: 'SUSPENDED' })
      .expect(200);
    await request(app.getHttpServer())
      .get('/me')
      .set('Cookie', cookie)
      .expect(401);
    await api('patch', 'companies/' + id + '/status')
      .send({ status: 'ACTIVE' })
      .expect(200);
    await request(app.getHttpServer())
      .get('/me')
      .set('Cookie', await login(admin.email, data.loginCode))
      .expect(200);
    expect(
      await root.auditLog.findMany({
        where: { tenantId: id, userId: platformId },
        select: { action: true },
      }),
    ).toEqual(
      expect.arrayContaining([
        { action: 'CREATE_TENANT' },
        { action: 'ASSIGN_ROLE' },
        { action: 'UPDATE_TENANT' },
        { action: 'UPDATE_TENANT_STATUS' },
      ]),
    );
  });

  it('filters and updates pilot requests and converts each request at most once', async () => {
    const lead = await makeLead();
    await api('patch', 'leads/' + lead.id)
      .send({ status: 'PILOT', assigneeId: a.users[0].id })
      .expect(404);
    await api('patch', 'leads/' + lead.id)
      .send({
        status: 'DEMOED',
        assigneeId: platformId,
        notes: '<script>alert(1)</script>',
      })
      .expect(200);
    const { body } = await api('get', 'leads')
      .query({ status: 'DEMOED', assigneeId: platformId, search: 'Pilot T07' })
      .expect(200);
    expect(body.leads).toEqual([
      expect.objectContaining({
        id: lead.id,
        status: 'DEMOED',
        fullName: lead.fullName,
        notes: '<script>alert(1)</script>',
      }),
    ]);
    expect(body.leads[0]).not.toHaveProperty('ip');
    expect(body.staff).toContainEqual({
      id: platformId,
      fullName: 'Quản trị nền tảng',
    });
    await api('get', 'leads/' + lead.id).expect(200);

    send.mockRejectedValueOnce(new Error('SMTP unavailable'));
    const requests = await Promise.all(
      [companyInput(), companyInput()].map((data) =>
        api('post', 'companies').send({ ...data, leadId: lead.id }),
      ),
    );
    const [first, second] = requests.sort((x, y) => x.status - y.status);
    for (const response of requests)
      if (response.status === 201) tenants.add(response.body.id);
    expect([first.status, second.status]).toEqual([201, 409]);
    expect(first.body.invitationSent).toBe(false);
    const id = first.body.id as string;
    await api('get', 'leads/' + lead.id)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({ tenantId: id, status: 'DEMOED' }),
      );
    await api('post', 'companies/' + id + '/invitation')
      .expect(201)
      .expect({ invitationSent: true });
  });

  it('manages the catalog, renews and replaces subscriptions, and preserves payment history', async () => {
    const details = {
      name: 'Gói T07',
      maxAccounts: '25',
      storageGb: '5',
      price: '250000',
      cycle: 'MONTHLY',
    };
    const { body: plan } = await api('post', 'plans').send(details).expect(201);
    planIds.add(plan.id);
    const replacement = await api('post', 'plans')
      .send({ ...details, name: 'Gói năm T07', cycle: 'YEARLY' })
      .expect(201);
    planIds.add(replacement.body.id);
    await api('patch', 'plans/' + plan.id)
      .send({ ...details, maxAccounts: '30' })
      .expect(200);
    await api('get', 'plans')
      .expect(200)
      .expect((response) =>
        expect(response.body).toContainEqual(
          expect.objectContaining({ id: plan.id, maxAccounts: 30 }),
        ),
      );

    const path = 'companies/' + a.tenantId + '/subscriptions';
    const assignment = {
      planId: plan.id,
      startsAt: '2026-11-27',
      endsAt: '2026-12-27',
    };
    await api('post', path)
      .send({ ...assignment, endsAt: '2026-02-30' })
      .expect(400);
    const assigned = await api('post', path).send(assignment).expect(201);
    const id = assigned.body.id as string;
    const payment = {
      amount: '250000',
      paidAt: '2026-11-27',
      notes: 'Chuyển khoản',
    };
    await api(
      'post',
      'companies/' + b.tenantId + '/subscriptions/' + id + '/payments',
    )
      .send(payment)
      .expect(404);
    await api('post', path + '/' + id + '/payments')
      .send({ ...payment, amount: '0' })
      .expect(400);
    await api('post', path + '/' + id + '/payments')
      .send(payment)
      .expect(201);
    await api('patch', path + '/' + id)
      .send({ endsAt: '2026-12-01' })
      .expect(409);
    await api('patch', path + '/' + id)
      .send({ endsAt: '2027-01-27' })
      .expect(200);
    const next = await api('post', path)
      .send({
        ...assignment,
        planId: replacement.body.id,
        startsAt: '2027-01-28',
        endsAt: '2028-01-27',
      })
      .expect(201);
    const billing = await api('get', path).expect(200);
    expect(billing.body).toEqual([
      expect.objectContaining({
        id: next.body.id,
        status: 'ACTIVE',
        payments: [],
      }),
      expect.objectContaining({
        id,
        status: 'CANCELLED',
        endsAt: '2027-01-27T16:59:59.999Z',
        payments: [
          expect.objectContaining({
            amount: '250000',
            paidAt: '2026-11-26T17:00:00.000Z',
            notes: payment.notes,
          }),
        ],
      }),
    ]);
    expect(
      await root.auditLog.findMany({
        where: { tenantId: a.tenantId, userId: platformId },
        select: { action: true },
      }),
    ).toEqual(
      expect.arrayContaining([
        { action: 'ASSIGN_SUBSCRIPTION' },
        { action: 'RECORD_PAYMENT' },
        { action: 'RENEW_SUBSCRIPTION' },
      ]),
    );
  });
});
