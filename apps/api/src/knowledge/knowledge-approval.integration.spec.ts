import 'reflect-metadata';
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { webOrigin } from '../auth/auth-policy';
import {
  createTenantFixture,
  removeTenantFixture,
} from '../testing/tenant-fixture';
import { KnowledgeModule } from './knowledge.module';

const integration =
  process.env.TENANT_INTEGRATION_TEST === 'true' ? describe : describe.skip;
const password = 'TestPassword36!';
const body = {
  title: 'Hướng dẫn vận hành',
  summary: 'Tóm tắt',
  bodyHtml: '<p>Hướng dẫn cũ</p>',
};

integration('T12 knowledge approval', () => {
  const root = new PrismaClient();
  let app: INestApplication;
  let own: Awaited<ReturnType<typeof createTenantFixture>>;
  let other: typeof own;
  let outsideDepartment: string;
  let admin: string;
  let reviewer: string;
  let employee: string;
  let foreignAdmin: string;

  function api(method: 'get' | 'post' | 'patch', path: string, cookie = admin) {
    return request(app.getHttpServer())
      [method]('/knowledge' + path)
      .set('Origin', webOrigin())
      .set('Cookie', cookie);
  }

  async function login(identifier: string) {
    const result = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', webOrigin())
      .send({ identifier, password })
      .expect(204);
    return result.headers['set-cookie'][0].split(';')[0] as string;
  }

  async function draft(data = {}, cookie = admin) {
    return (
      await api('post', '/editor/drafts', cookie)
        .send({
          ...body,
          audience: 'DEPARTMENTS',
          departmentIds: [own.department.id],
          ...data,
        })
        .expect(201)
    ).body;
  }

  async function submit(id: string) {
    return (await api('post', '/editor/versions/' + id + '/submit').expect(200))
      .body;
  }

  beforeAll(async () => {
    const passwordHash = await hash(password);
    [own, other] = await Promise.all([
      createTenantFixture(root, passwordHash),
      createTenantFixture(root, passwordHash),
    ]);
    outsideDepartment = (
      await root.department.create({
        data: { tenantId: own.tenantId, name: 'Khác' },
      })
    ).id;
    await root.userRole.create({
      data: {
        tenantId: own.tenantId,
        userId: own.users[1].id,
        role: 'PD',
        departmentIds: [own.department.id],
      },
    });
    const module = await Test.createTestingModule({
      imports: [KnowledgeModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    [admin, reviewer, employee, foreignAdmin] = await Promise.all([
      login(own.users[0].email),
      login(own.users[1].email),
      login(own.users[2].email),
      login(other.users[0].email),
    ]);
  });

  afterAll(async () => {
    try {
      for (const fixture of [own, other]) {
        if (!fixture) continue;
        const where = { tenantId: fixture.tenantId };
        await root.knowledgeVersion.deleteMany({ where });
        await root.knowledgeItem.deleteMany({ where });
        await root.fileObject.deleteMany({ where });
        await removeTenantFixture(root, fixture.tenantId);
      }
    } finally {
      await app?.close();
      await root.$disconnect();
    }
  });

  it('withdraws, rejects with a required reason, notifies only the creator, and publishes atomically after resubmission', async () => {
    const current = await draft();
    const edit = '/editor/drafts/' + current.itemId;
    const actions = '/editor/versions/' + current.id;
    const review = '/reviews/' + current.id;
    const read = '/read/' + current.itemId;
    await api('get', read, employee).expect(404);
    await api('post', actions + '/publish').expect(403);
    await api('post', review + '/approve', reviewer)
      .send({ token: randomUUID() })
      .expect(409);
    const first = await submit(current.id);
    await api('get', read, employee).expect(404);
    await api('patch', edit)
      .send({ ...body, audience: 'TENANT' })
      .expect(404);
    await api('post', actions + '/withdraw')
      .send({ token: first.reviewToken })
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('DRAFT'));
    await api('get', review, reviewer).expect(404);

    const pending = await submit(current.id);
    await api('get', review, reviewer)
      .expect(200)
      .expect(({ body }) => expect(body.bodyHtml).toContain('Hướng dẫn cũ'));
    await api('post', review + '/approve', reviewer)
      .send({ token: first.reviewToken })
      .expect(409);
    await api('post', review + '/approve')
      .send({ token: pending.reviewToken })
      .expect(403);
    await api('post', review + '/reject', reviewer)
      .send({ token: pending.reviewToken, reason: '  ' })
      .expect(400);
    const reason = 'Cần cập nhật quy trình';
    await api('post', review + '/reject', reviewer)
      .send({ token: pending.reviewToken, reason })
      .expect(200);
    await api('get', edit)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          status: 'DRAFT',
          rejectionReason: reason,
        }),
      );
    await api('get', '/rejections')
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual([
          expect.objectContaining({ title: current.title, reason }),
        ]),
      );
    for (const cookie of [employee, reviewer, foreignAdmin]) {
      await api('get', '/rejections', cookie)
        .expect(200)
        .expect(({ body }) => expect(body).toEqual([]));
    }

    const resubmitted = await submit(current.id);
    const decisions = await Promise.all(
      [1, 2].map(() =>
        api('post', review + '/approve', reviewer).send({
          token: resubmitted.reviewToken,
        }),
      ),
    );
    expect(decisions.map(({ status }) => status).sort()).toEqual([200, 409]);
    await api('get', read, employee).expect(200);
    const audit = await root.auditLog.findMany({
      where: { tenantId: own.tenantId, objectId: current.id },
      orderBy: { occurredAt: 'asc' },
    });
    expect(audit.map(({ action, userId }) => ({ action, userId }))).toEqual([
      { action: 'knowledge.reject', userId: own.users[1].id },
      { action: 'knowledge.approve', userId: own.users[1].id },
    ]);
  });

  it('applies the reviewer department scope and isolates every workflow route across tenants', async () => {
    const inScope = await draft();
    const pending = await submit(inScope.id);
    const outside = await draft({
      departmentIds: [own.department.id, outsideDepartment],
    });
    await submit(outside.id);
    const foreign = await draft(
      { audience: 'TENANT', departmentIds: [] },
      foreignAdmin,
    );
    const foreignPending = (
      await api(
        'post',
        '/editor/versions/' + foreign.id + '/submit',
        foreignAdmin,
      ).expect(200)
    ).body;

    await api('get', '/reviews', reviewer)
      .expect(200)
      .expect(({ body }) =>
        expect(body.map(({ id }: { id: string }) => id)).toEqual([inScope.id]),
      );
    await api('get', '/reviews', foreignAdmin)
      .expect(200)
      .expect(({ body }) =>
        expect(body.map(({ id }: { id: string }) => id)).toEqual([foreign.id]),
      );
    await api('get', '/reviews', employee).expect(403);
    await api('get', '/reviews/' + outside.id, reviewer).expect(404);
    await api('post', '/reviews/' + outside.id + '/approve', reviewer)
      .send({ token: pending.reviewToken })
      .expect(404);
    const id = foreign.id;
    const files = '/files/' + randomUUID();
    await api('get', '/reviews/' + id).expect(404);
    await api('get', '/reviews/' + id + files).expect(404);
    await api('get', '/editor/submissions/' + id).expect(404);
    await api('get', '/editor/submissions/' + id + files).expect(404);
    for (const action of ['submit', 'withdraw', 'publish']) {
      await api('post', '/editor/versions/' + id + '/' + action)
        .send({ token: foreignPending.reviewToken })
        .expect(404);
    }
    for (const action of ['approve', 'reject']) {
      await api('post', '/reviews/' + id + '/' + action)
        .send({ token: foreignPending.reviewToken, reason: 'Lý do' })
        .expect(404);
    }
    await api(
      'post',
      '/editor/publications/' + foreign.itemId + '/history/' + id + '/draft',
    ).expect(404);
    expect(
      (await root.knowledgeVersion.findUniqueOrThrow({ where: { id } })).status,
    ).toBe('IN_REVIEW');
  });

  it('self-publishes only with configured approval rights and keeps the prior version and its files intact', async () => {
    await root.tenant.update({
      where: { id: own.tenantId },
      data: { config: { selfApproval: true } },
    });
    try {
      const fileId = randomUUID();
      const file = await root.fileObject.create({
        data: {
          id: fileId,
          tenantId: own.tenantId,
          createdBy: own.users[0].id,
          contentType: 'application/pdf',
          name: 'Quy trình.pdf',
          sizeBytes: 42n,
          storageKey: own.tenantId + '/' + fileId,
        },
      });
      const current = await draft({ fileIds: [file.id] });
      await api('post', '/editor/versions/' + current.id + '/publish').expect(
        200,
      );
      const publication = '/editor/publications/' + current.itemId + '/history';
      const read = '/read/' + current.itemId;
      const start = publication + '/' + current.id + '/draft';
      const { body: next } = await api('post', start).expect(201);
      expect(next).toMatchObject({
        revision: 2,
        status: 'DRAFT',
        attachments: [{ file: { id: file.id } }],
      });
      await api('post', start).expect(409);
      await api('patch', '/editor/drafts/' + current.itemId)
        .send({
          ...body,
          title: 'Hướng dẫn mới',
          bodyHtml: '<p>Nội dung mới</p>',
          audience: 'TENANT',
        })
        .expect(200);
      const pending = await submit(next.id);
      await api('get', read, employee)
        .expect(200)
        .expect(({ body }) => expect(body.title).toBe(current.title));
      await api('post', '/reviews/' + next.id + '/approve')
        .send({ token: pending.reviewToken })
        .expect(200);
      await api('get', read, employee)
        .expect(200)
        .expect(({ body }) => expect(body.title).toBe('Hướng dẫn mới'));
      await api('get', publication)
        .expect(200)
        .expect(({ body }) =>
          expect(
            body.map(({ revision }: { revision: number }) => revision),
          ).toEqual([2, 1]),
        );
      await api('get', publication + '/' + current.id)
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            title: current.title,
            attachments: [{ file: { id: file.id } }],
          }),
        );
      await api('get', publication + '/' + current.id, foreignAdmin).expect(
        404,
      );
      await api('get', publication + '/' + current.id, employee).expect(403);
      const audit = await root.auditLog.findFirstOrThrow({
        where: { objectId: current.id, action: 'knowledge.approve' },
      });
      expect(audit).toMatchObject({
        userId: own.users[0].id,
        before: { status: 'DRAFT' },
        after: { status: 'PUBLISHED', selfApproved: true },
      });
      await root.userRole.create({
        data: { tenantId: own.tenantId, userId: own.users[2].id, role: 'PTDT' },
      });
      const trainer = await draft({}, employee);
      await api(
        'post',
        '/editor/versions/' + trainer.id + '/publish',
        employee,
      ).expect(403);
      await api(
        'post',
        '/editor/versions/' + trainer.id + '/submit',
        admin,
      ).expect(403);
    } finally {
      await root.tenant.update({
        where: { id: own.tenantId },
        data: { config: {} },
      });
    }
  });
});
