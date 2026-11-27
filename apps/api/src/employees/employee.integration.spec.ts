import 'reflect-metadata';
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';
import { Workbook } from 'exceljs';
import request from 'supertest';
import { AppModule } from '../app.module';
import { webOrigin } from '../auth/auth-policy';
import { NoticeCollector } from '../handover/notice-collector';
import { NoticeEmail } from '../handover/notice-email';
import { LeadInfrastructure } from '../leads/leads.infrastructure';
import * as smtp from '../smtp';
import {
  createTenantFixture,
  removeTenantFixture,
} from '../testing/tenant-fixture';
import { employeeColumns } from './employee-input';

const integration =
  process.env.TENANT_INTEGRATION_TEST === 'true' ? describe : describe.skip;
const password = 'TestPassword36!';

integration('T09 employee management', () => {
  const root = new PrismaClient();
  const sendMail = jest
    .fn<Promise<object>, [{ to: string; subject: string; text: string }]>()
    .mockResolvedValue({});
  let app: INestApplication;
  let own: Awaited<ReturnType<typeof createTenantFixture>>;
  let other: typeof own;
  let admin: string;
  let employee: string;
  let planId: string | undefined;
  let operatorId: string | undefined;
  let operatorEmail: string;

  function api(
    method: 'get' | 'post' | 'patch' | 'delete',
    route = '',
    cookie = admin,
  ) {
    return request(app.getHttpServer())
      [method]('/employees' + route)
      .set('Origin', webOrigin())
      .set('Cookie', cookie);
  }

  function auth(route: string) {
    return request(app.getHttpServer())
      .post('/auth/' + route)
      .set('Origin', webOrigin());
  }

  async function login(identifier: string) {
    const response = await auth('login')
      .send({ identifier, password })
      .expect(204);
    return response.headers['set-cookie'][0].split(';')[0] as string;
  }

  function data(code: string, extra: Record<string, unknown> = {}) {
    return {
      employeeCode: code,
      fullName: 'Nhân viên ' + code,
      email: code.toLowerCase() + '@' + own.tenantId + '.example',
      departmentId: own.department.id,
      positionId: own.position.id,
      managerId: own.users[0].id,
      joinedAt: '27/11/2026',
      phone: '0912345678',
      ...extra,
    };
  }

  beforeAll(async () => {
    const passwordHash = await hash(password);
    own = await createTenantFixture(root, passwordHash);
    other = await createTenantFixture(root, passwordHash);
    operatorEmail = 'qtnt@' + own.tenantId + '.example';
    const operator = await root.user.create({
      data: {
        email: operatorEmail,
        fullName: 'QTNT kiểm thử',
        status: 'ACTIVE',
        passwordHash,
        roles: { create: { role: 'QTNT' } },
      },
    });
    operatorId = operator.id;
    jest
      .spyOn(smtp, 'createSmtpTransport')
      .mockReturnValue({ sendMail, close: jest.fn() } as unknown as ReturnType<
        typeof smtp.createSmtpTransport
      >);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LeadInfrastructure)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    await app.init();
    admin = await login(own.users[0].email);
    employee = await login(own.users[1].email);
  });

  afterAll(async () => {
    try {
      if (own) {
        await root.knowledgeVersion.deleteMany({
          where: { tenantId: own.tenantId },
        });
        await root.knowledgeItem.deleteMany({
          where: { tenantId: own.tenantId },
        });
      }
      if (own)
        await root.handoverCase.deleteMany({
          where: { tenantId: own.tenantId },
        });
      if (other)
        await root.handoverCase.deleteMany({
          where: { tenantId: other.tenantId },
        });
      if (own) await removeTenantFixture(root, own.tenantId);
      if (other) await removeTenantFixture(root, other.tenantId);
      if (planId) await root.plan.delete({ where: { id: planId } });
      if (operatorId) {
        await root.userRole.deleteMany({ where: { userId: operatorId } });
        await root.user.delete({ where: { id: operatorId } });
      }
    } finally {
      jest.restoreAllMocks();
      await app?.close();
      await root.$disconnect();
    }
  });

  it('scopes every endpoint to the admin session and rejects foreign references', async () => {
    const foreign = other.users[0];
    const list = await api('get', '?tenantId=' + other.tenantId).expect(200);
    expect(
      list.body.employees.map(({ id }: { id: string }) => id),
    ).not.toContain(foreign.id);
    expect(list.body.employees).toHaveLength(3);
    const template = await api('get', '/template?tenantId=' + other.tenantId)
      .buffer(true)
      .parse((stream, callback) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('error', callback);
        stream.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const workbook = new Workbook();
    await workbook.xlsx.load(Uint8Array.from(template.body as Buffer).buffer);
    expect(workbook.getWorksheet('Phòng ban')?.getCell('A2').value).toBe(
      own.department.id,
    );
    expect(workbook.getWorksheet('Phòng ban')?.rowCount).toBe(2);
    const created = await api('post')
      .send(data('ISOLATION', { tenantId: other.tenantId }))
      .expect(201);
    expect(
      await root.user.findUnique({ where: { id: created.body.id } }),
    ).toMatchObject({ tenantId: own.tenantId });
    expect(created.body).not.toHaveProperty('passwordHash');

    for (const [field, id] of Object.entries({
      departmentId: other.department.id,
      positionId: other.position.id,
      managerId: foreign.id,
    })) {
      await api('post')
        .send(data('FOREIGN', { [field]: id }))
        .expect(400);
      await api('patch', '/' + created.body.id)
        .send(data('ISOLATION', { [field]: id }))
        .expect(400);
    }
    await api('patch', '/' + foreign.id)
      .send(data('ISOLATION'))
      .expect(404);
    await api('patch', '/' + foreign.id + '/roles')
      .send({ roles: [] })
      .expect(404);
    await api('patch', '/' + created.body.id + '/roles')
      .send({ roles: [{ role: 'PD', departmentIds: [other.department.id] }] })
      .expect(400);
    await api('post', '/' + foreign.id + '/activate').expect(404);
    await api('post', '/' + foreign.id + '/disable')
      .send({})
      .expect(404);
    await api('delete', '/' + foreign.id).expect(404);
    expect(await root.user.findUnique({ where: { id: foreign.id } })).toEqual(
      foreign,
    );

    await api('get', '', employee).expect(403);
    await api('get', '/template', employee).expect(403);
    await api('post', '/import', employee).expect(403);
    await api('post', '', employee).send(data('DENIED')).expect(403);
    await api('patch', '/' + created.body.id, employee)
      .send(data('DENIED'))
      .expect(403);
    await api('patch', '/' + created.body.id + '/roles', employee)
      .send({ roles: [] })
      .expect(403);
    await api('post', '/' + created.body.id + '/activate', employee).expect(
      403,
    );
    await api('post', '/' + created.body.id + '/disable', employee)
      .send({})
      .expect(403);
    await api('delete', '/' + created.body.id, employee).expect(403);
    await api('delete', '/' + created.body.id).expect(200);
    expect((await api('get').expect(200)).body.employees).toHaveLength(3);
  });

  it('validates unique identifiers, manager cycles, scope, and the last active ADM', async () => {
    const id = own.users[0].id;
    const target = own.users[1].id;
    await api('patch', '/' + id + '/roles')
      .send({ roles: [] })
      .expect(409);
    await api('post', '/' + id + '/disable')
      .send({})
      .expect(409);
    await api('post').send(data('nv001')).expect(409);
    await api('post')
      .send(data('OTHER', { email: own.users[0].email.toUpperCase() }))
      .expect(409);
    await api('patch', '/' + target)
      .send(data('NV002', { email: own.users[1].email }))
      .expect(200);
    await api('patch', '/' + id)
      .send(data('NV001', { email: own.users[0].email, managerId: target }))
      .expect(400);
    const roles = [
      { role: 'PTDT', departmentIds: [own.department.id] },
      { role: 'PD', departmentIds: [] },
    ];
    const response = await api('patch', '/' + target + '/roles')
      .send({ roles })
      .expect(200);
    expect(response.body.roles).toEqual(expect.arrayContaining(roles));
    expect(
      await root.auditLog.count({
        where: {
          tenantId: own.tenantId,
          userId: id,
          objectId: target,
          action: 'CHANGE_USER_ROLES',
        },
      }),
    ).toBe(1);
  });

  async function importFile(corrupt: boolean) {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Nhân viên');
    sheet.addRow(Object.values(employeeColumns));
    for (let index = 1; index <= 200; index++) {
      const row = data('IMPORT' + index, { phone: '' });
      if (corrupt && index === 9) row.email = 'sai-email';
      if (corrupt && index === 51) row.departmentId = other.department.id;
      if (corrupt && index === 180) row.employeeCode = 'NV001';
      sheet.addRow([
        row.employeeCode,
        row.fullName,
        row.email,
        row.phone,
        row.departmentId,
        row.positionId,
        row.managerId,
        row.joinedAt,
      ]);
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  it('checks 200 Excel rows, reports exactly 3 errors and writes only after a clean confirmation', async () => {
    const bad = await importFile(true);
    const good = await importFile(false);
    const upload = (buffer: Buffer, commit = false) =>
      api(
        'post',
        '/import?tenantId=' + other.tenantId + '&commit=' + commit,
      ).attach('file', buffer, 'employees.xlsx');
    const count = () => root.user.count({ where: { tenantId: own.tenantId } });
    const initial = await count();
    for (const commit of [false, true]) {
      const response = await upload(bad, commit).expect(201);
      expect(response.body).toMatchObject({ rows: 200, imported: 0 });
      expect(
        response.body.errors.map(({ row }: { row: number }) => row),
      ).toEqual([10, 52, 181]);
      expect(await count()).toBe(initial);
    }
    await upload(good).expect(201, { rows: 200, errors: [], imported: 0 });
    expect(await count()).toBe(initial);
    await upload(good, true).expect(201, {
      rows: 200,
      errors: [],
      imported: 200,
    });
    expect(await count()).toBe(initial + 200);
    expect(await root.user.count({ where: { tenantId: other.tenantId } })).toBe(
      3,
    );
    expect(
      await root.user.count({
        where: {
          tenantId: own.tenantId,
          employeeCode: { startsWith: 'IMPORT' },
          status: 'PENDING',
          roles: { some: { role: 'NV' } },
        },
      }),
    ).toBe(200);
  });

  it('AC-02 serializes activation, notifies ADM and QTNT, and delivers a one-use invitation', async () => {
    const plan = await root.plan.create({
      data: {
        name: 'Gói kiểm thử T09',
        maxAccounts: 4,
        storageGb: 10,
        price: 0,
        cycle: 'MONTHLY',
      },
    });
    planId = plan.id;
    const subscription = await root.subscription.create({
      data: {
        tenantId: own.tenantId,
        planId,
        startsAt: new Date(),
        endsAt: new Date('2099-01-01'),
      },
    });
    const first = (await api('post').send(data('LIMIT1')).expect(201)).body;
    const second = (await api('post').send(data('LIMIT2')).expect(201)).body;
    expect((await api('get').expect(200)).body.quota).toMatchObject({
      accountWarning: false,
      storageWarning: false,
    });
    await root.tenant.update({
      where: { id: own.tenantId },
      data: { storageUsedBytes: 9n * 1024n ** 3n },
    });
    expect((await api('get').expect(200)).body.quota.storageWarning).toBe(true);
    const activation = (id: string) => api('post', '/' + id + '/activate');
    const results = await Promise.all([
      activation(first.id),
      activation(second.id),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([201, 409]);
    const accepted = results[0].status === 201 ? first : second;
    const rejected = results[0].status === 409 ? first : second;
    expect(
      results.find(({ status }) => status === 409)?.body.message,
    ).toContain('Đã đạt giới hạn');
    expect(
      await root.user.findUnique({ where: { id: rejected.id } }),
    ).toMatchObject({ status: 'PENDING' });
    expect((await api('get').expect(200)).body.quota).toMatchObject({
      accounts: 4,
      maxAccounts: 4,
      accountWarning: true,
    });
    const messages = sendMail.mock.calls.map(([message]) => message);
    expect(
      messages
        .filter(({ subject }) => subject.includes('giới hạn'))
        .map(({ to }) => to),
    ).toEqual(expect.arrayContaining([own.users[0].email, operatorEmail]));
    expect(messages.some(({ to }) => to === other.users[0].email)).toBe(false);
    const invitation = messages.find(({ to }) => to === accepted.email);
    const token = new URLSearchParams(invitation?.text.split('#')[1]).get(
      'token',
    );
    expect(token).toBeTruthy();
    await auth('login')
      .send({ identifier: accepted.email, password })
      .expect(401);
    await auth('reset-password')
      .send({ token, password, mode: 'invite' })
      .expect(204);
    await auth('reset-password')
      .send({ token, password, mode: 'invite' })
      .expect(401);
    const cookie = await login(accepted.email);
    await api('post', '/' + accepted.id + '/disable')
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .get('/me')
      .set('Cookie', cookie)
      .expect(401);
    await activation(rejected.id).expect(201);
    expect(
      await root.subscription.findUnique({ where: { id: subscription.id } }),
    ).toMatchObject({ billableAccounts: 4 });
    expect(
      await root.auditLog.count({
        where: {
          tenantId: own.tenantId,
          objectId: accepted.id,
          action: { in: ['ACTIVATE_USER', 'DISABLE_USER'] },
        },
      }),
    ).toBe(2);
  });
  it('starts a single handover and rejects another tenant and unauthorized employees', async () => {
    const employeeId = own.users[1].id;
    const route = `/${employeeId}/handover`;
    const input = { departureOn: '15/12/2030' };
    const foreignAdmin = await login(other.users[0].email);
    await root.user.update({
      where: { id: employeeId },
      data: { managerId: own.users[0].id },
    });
    await api('post', route, foreignAdmin).send(input).expect(403);
    await api('post', route, employee).send(input).expect(403);
    await api('post', route)
      .send({ ...input, tenantId: other.tenantId })
      .expect(400);
    const started = await api('post', route).send(input).expect(201);
    expect(started.body).toMatchObject({
      employeeId,
      departureOn: '2030-12-15T00:00:00.000Z',
    });
    const retry = await api('post', route).send(input).expect(201);
    expect(retry.body.id).toBe(started.body.id);
    expect(
      await root.auditLog.count({
        where: { objectId: started.body.id, action: 'handover.start' },
      }),
    ).toBe(1);
    await api('post', `/${employeeId}/disable`).send({}).expect(400);
    const caseId = started.body.id as string;
    const recipientId = own.users[2].id;
    const recipient = await login(own.users[2].email);
    const http = (method: 'get' | 'post', path: string, cookie = admin) =>
      request(app.getHttpServer())
        [method](path)
        .set('Origin', webOrigin())
        .set('Cookie', cookie);
    const action = (name: string, cookie = admin) =>
      http('post', `/handovers/${caseId}/actions/${name}`, cookie);
    const directory = (cookie = admin) => http('get', '/handovers', cookie);
    expect((await directory(foreignAdmin).expect(200)).body.cases).toEqual([]);
    await action('submit', foreignAdmin).send({ items: [] }).expect(404);
    const items = [
      {
        category: 'EXPERIENCE',
        title: 'Bàn giao quy trình',
        description: 'Nội dung <thử nghiệm>',
        recipientId,
      },
    ];
    await action('submit').send({ items }).expect(400);
    await action('submit')
      .send({ items, substituteReason: 'Nhân viên nhờ lập thay' })
      .expect(201);
    await action('complete').send({}).expect(409);
    const submitted = (await directory(recipient).expect(200)).body.cases[0];
    expect(submitted.items).toHaveLength(1);
    const itemId = submitted.items[0].id as string;
    await action('accept', employee).send({ itemId }).expect(403);
    await action('reject', recipient).send({ itemId }).expect(400);
    await action('reject', recipient)
      .send({ itemId, reason: 'Bổ sung thông tin' })
      .expect(201);
    const rejected = (await directory().expect(200)).body.cases[0];
    expect(rejected).toMatchObject({
      status: 'REVISION',
      substituteReason: 'Nhân viên nhờ lập thay',
      items: [{ reason: 'Bổ sung thông tin' }],
    });
    await action('submit')
      .send({ items, substituteReason: 'Đã bổ sung thông tin' })
      .expect(201);
    const corrected = (await directory(recipient).expect(200)).body.cases[0]
      .items[0].id as string;
    await action('accept', recipient).send({ itemId: corrected }).expect(201);
    await action('draft').send({ itemId: corrected }).expect(201);
    const draft = await root.knowledgeVersion.findFirstOrThrow({
      where: { tenantId: own.tenantId, title: items[0].title },
    });
    expect(draft).toMatchObject({
      status: 'DRAFT',
      bodyHtml: '<p>Nội dung &lt;thử nghiệm&gt;</p>',
    });
    await action('complete').send({}).expect(201);
    await action('submit')
      .send({ items, substituteReason: 'Đã đóng hồ sơ' })
      .expect(409);
    await http('get', '/me', employee).expect(401);
    const notices = (await http('get', '/notices', recipient).expect(200)).body;
    const noticeId = notices[0].id as string;
    await http('post', `/notices/${noticeId}/read`, foreignAdmin).expect(201);
    expect(
      (await http('get', '/notices', recipient).expect(200)).body[0].readAt,
    ).toBeNull();
    await http('post', `/notices/${noticeId}/read`, recipient).expect(201);
    expect(
      (await http('get', '/notices', recipient).expect(200)).body[0].readAt,
    ).not.toBeNull();
    const reportPath = `/reports?employeeId=${employeeId}`;
    expect(
      (await http('get', reportPath, foreignAdmin).expect(200)).body.cases,
    ).toEqual([]);
    expect(
      (await http('get', reportPath).expect(200)).body.cases,
    ).toMatchObject([{ id: caseId, status: 'Hoàn tất' }]);
    const exported = await http(
      'get',
      `/reports/export?employeeId=${employeeId}`,
    )
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const workbook = new Workbook();
    await workbook.xlsx.load(exported.body);
    expect(workbook.getWorksheet('Bàn giao')?.getCell('C2').value).toBe(
      'Hoàn tất',
    );
  });
  it('sends only generic notice email within the tenant and respects optional groups', async () => {
    const recipient = own.users[2];
    const cookie = await login(recipient.email);
    const preferences = () =>
      request(app.getHttpServer())
        .patch('/notices/preferences')
        .set('Origin', webOrigin())
        .set('Cookie', cookie);
    await preferences().send(['handover']).expect(400);
    await preferences().send(['training']).expect(200, ['training']);
    await root.workspaceNotice.updateMany({
      where: { tenantId: own.tenantId },
      data: { emailHandledAt: new Date() },
    });
    const notice = (tenantId: string, userId: string, eventKey: string) => ({
      tenantId,
      userId,
      eventKey,
      message: 'Chi tiết nghiệp vụ riêng tư',
    });
    await root.workspaceNotice.createMany({
      data: [
        notice(own.tenantId, recipient.id, 'training:test:assigned'),
        notice(other.tenantId, other.users[2].id, 'handover:test:start'),
      ],
    });
    const mailer = app.get(NoticeEmail);
    sendMail.mockClear();
    await mailer.deliver(own.tenantId);
    expect(sendMail).not.toHaveBeenCalled();
    await root.workspaceNotice.createMany({
      data: [
        notice(own.tenantId, recipient.id, 'handover:test:start'),
        notice(own.tenantId, recipient.id, 'training:test:overdue:date'),
      ],
    });
    await Promise.all([
      mailer.deliver(own.tenantId),
      mailer.deliver(own.tenantId),
    ]);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: recipient.email,
        subject: 'Thông báo EduCore36',
        text: `Bạn có thông báo mới trên EduCore36\n${new URL('/dang-nhap', webOrigin()).href}`,
      }),
    );
    await mailer.deliver(own.tenantId);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
  it('limits a departing employee to handover after the deadline and requires a no-item explanation', async () => {
    const user = own.users[2];
    const cookie = await login(user.email);
    await api('post', `/${own.users[0].id}/handover`)
      .send({ departureOn: '01/01/2020' })
      .expect(409);
    const started = await api('post', `/${user.id}/handover`)
      .send({ departureOn: '01/01/2020' })
      .expect(201);
    const profile = await request(app.getHttpServer())
      .get('/me')
      .set('Cookie', cookie)
      .expect(200);
    const permissions = profile.body.permissions.map(
      ({ permission }: { permission: string }) => permission,
    );
    expect(permissions).toContain('handover.prepare');
    expect(permissions).not.toContain('learning.use');
    const collector = app.get(NoticeCollector);
    await collector.collectForTenant(own.tenantId);
    await collector.collectForTenant(own.tenantId);
    expect(
      await root.workspaceNotice.count({
        where: {
          tenantId: own.tenantId,
          userId: user.id,
          eventKey: `handover:${started.body.id}:overdue`,
        },
      }),
    ).toBe(1);
    const action = (name: string, session: string) =>
      request(app.getHttpServer())
        .post(`/handovers/${started.body.id}/actions/${name}`)
        .set('Origin', webOrigin())
        .set('Cookie', session);
    await action('submit', cookie).send({ items: [] }).expect(400);
    await action('submit', cookie)
      .send({ items: [], explanation: 'Chưa được giao công việc cần bàn giao' })
      .expect(201, { status: 'REVIEW' });
    await action('complete', cookie).send({}).expect(403);
    await action('complete', admin)
      .send({})
      .expect(201, { status: 'COMPLETED' });
  });
});
