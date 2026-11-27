import 'reflect-metadata';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import {
  Controller,
  Get,
  Inject,
  Param,
  UseGuards,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { hash, verify } from 'argon2';
import request from 'supertest';
import {
  createTenantFixture,
  removeTenantFixture,
} from '../testing/tenant-fixture';
import { TenantDatabase } from '../tenant/tenant-database';
import { SessionGuard } from './auth-http';
import { AuthMailer } from './auth-mailer';
import { AuthModule } from './auth.module';
import { authPolicy, digest, sessionCookie, webOrigin } from './auth-policy';
import { AuthService } from './auth.service';
import { RequirePermission } from './authorization.guard';

@Controller('test-session')
class SessionProbeController {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  @Get(':id')
  @UseGuards(SessionGuard)
  async find(@Param('id') id: string) {
    const user = await this.database.client.user.findUnique({
      where: { id },
      select: { id: true },
    });
    return { id: user?.id ?? null };
  }

  @Get('report/:id')
  @RequirePermission('training.report', async (client, req) => {
    const user = await client.user.findUnique({
      where: { id: req.params.id as string },
      select: { id: true, tenantId: true, managerId: true, departmentId: true },
    });
    return user?.tenantId
      ? {
          tenantId: user.tenantId,
          employee: user,
          departmentIds: [user.departmentId],
        }
      : null;
  })
  report() {
    return { allowed: true };
  }
}

const integration =
  process.env.TENANT_INTEGRATION_TEST === 'true' ? describe : describe.skip;
const password = 'TestPassword36!';
const otherPassword = 'OtherPassword36!';
const newPassword = 'NewPassword36!';
const platformId = randomUUID();

integration('T04: authentication API and PostgreSQL RLS', () => {
  const root = new PrismaClient();
  const send = jest
    .fn<Promise<void>, Parameters<AuthMailer['send']>>()
    .mockResolvedValue(undefined);
  let app: INestApplication;
  let a: Awaited<ReturnType<typeof createTenantFixture>>;
  let b: typeof a;
  let codeA: string;
  let codeB: string;

  const post = (endpoint: string, body: object, cookie?: string) => {
    const call = request(app.getHttpServer())
      .post('/auth/' + endpoint)
      .set('Origin', webOrigin())
      .send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const login = async (
    identifier: string,
    inputPassword = password,
    companyCode?: string,
  ) => {
    const result = await post('login', {
      identifier,
      password: inputPassword,
      companyCode,
    }).expect(204);
    return String(result.headers['set-cookie'][0]).split(';')[0];
  };
  const tokenFromCookie = (cookie: string) =>
    cookie.slice(sessionCookie.length + 1);
  const latestEmailToken = () => send.mock.calls.at(-1)![2];
  const sessionProbe = (id: string, cookie: string) =>
    request(app.getHttpServer())
      .get('/test-session/' + id)
      .set('Cookie', cookie);

  beforeAll(async () => {
    const passwordHash = await hash(password);
    codeA = randomUUID();
    codeB = randomUUID();
    a = await createTenantFixture(root, passwordHash, codeA);
    b = await createTenantFixture(root, await hash(otherPassword), codeB);
    await root.user.create({
      data: {
        id: platformId,
        email: platformId + '@platform.example',
        fullName: 'QTNT',
        status: 'ACTIVE',
        passwordHash,
        roles: { create: { role: 'QTNT' } },
      },
    });
    const testingModule = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [SessionProbeController],
    })
      .overrideProvider(AuthMailer)
      .useValue({ send })
      .compile();
    app = testingModule.createNestApplication();
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    if (a) await removeTenantFixture(root, a.tenantId);
    if (b) await removeTenantFixture(root, b.tenantId);
    await root.auditLog.deleteMany({ where: { userId: platformId } });
    await root.userRole.deleteMany({ where: { userId: platformId } });
    await root.user.deleteMany({ where: { id: platformId } });
    await root.$disconnect();
  });

  beforeEach(() => send.mockClear());

  it('logs in by email and normalized phone with a private cookie and audit record', async () => {
    const [user] = a.users;
    const phone =
      '090' + String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0');
    await root.user.update({ where: { id: user.id }, data: { phone } });
    const response = await post('login', {
      identifier: user.email.toUpperCase(),
      password,
    }).expect(204);
    const header = String(response.headers['set-cookie'][0]);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Max-Age=' + authPolicy.sessionIdleMs / 1000);
    expect(response.headers['cache-control']).toBe('no-store');
    const secret = tokenFromCookie(header.split(';')[0]);
    const record = await root.authCredential.findUniqueOrThrow({
      where: { digest: digest(secret) },
    });
    expect(record).toMatchObject({
      userId: user.id,
      tenantId: a.tenantId,
      kind: 'SESSION',
    });
    await login('+84 ' + phone.slice(1), password, codeA);
    expect(
      await root.auditLog.count({
        where: { userId: user.id, action: 'LOGIN', tenantId: a.tenantId },
      }),
    ).toBeGreaterThanOrEqual(2);
  });

  it('locks atomically on five wrong attempts and allows login after fifteen minutes', async () => {
    const user = a.users[1];
    const start = Date.now();
    for (let attempt = 0; attempt < authPolicy.loginAttempts; attempt += 1) {
      await post('login', {
        identifier: user.email,
        password: 'incorrect',
      }).expect(401);
      const state = await root.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(state.failedLogins).toBe(attempt + 1);
      if (attempt < authPolicy.loginAttempts - 1)
        expect(state.lockedUntil).toBeNull();
      else {
        expect(state.lockedUntil!.getTime()).toBeGreaterThanOrEqual(
          start + authPolicy.lockMs,
        );
        expect(state.lockedUntil!.getTime()).toBeLessThanOrEqual(
          Date.now() + authPolicy.lockMs,
        );
      }
    }
    await post('login', { identifier: user.email, password }).expect(401);
    await root.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() - 1) },
    });
    await login(user.email);
    expect(
      await root.user.findUnique({ where: { id: user.id } }),
    ).toMatchObject({ failedLogins: 0, lockedUntil: null });
  });

  it('denies disabled accounts and suspended tenants, including existing sessions', async () => {
    const user = a.users[1];
    const cookie = await login(user.email);
    try {
      await root.user.update({
        where: { id: user.id },
        data: { status: 'DISABLED' },
      });
      await post('login', { identifier: user.email, password }).expect(401);
      await sessionProbe(user.id, cookie).expect(401);
      await root.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE' },
      });
      await root.tenant.update({
        where: { id: a.tenantId },
        data: { status: 'SUSPENDED' },
      });
      await post('login', { identifier: user.email, password }).expect(401);
      await sessionProbe(user.id, cookie).expect(401);
      await post('forgot-password', { email: user.email }).expect(200);
      expect(send).not.toHaveBeenCalled();
    } finally {
      await root.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE' },
      });
      await root.tenant.update({
        where: { id: a.tenantId },
        data: { status: 'ACTIVE' },
      });
    }
  });

  it('renews an active session and rejects it after seven idle days', async () => {
    const user = a.users[0];
    const cookie = await login(user.email);
    const where = { digest: digest(tokenFromCookie(cookie)) };
    await root.authCredential.update({
      where,
      data: { expiresAt: new Date(Date.now() + 60_000) },
    });
    const refreshed = await sessionProbe(user.id, cookie).expect(200, {
      id: user.id,
    });
    expect(refreshed.headers['cache-control']).toBe('private, no-store');
    expect(String(refreshed.headers['set-cookie'][0])).toContain(
      'Max-Age=' + authPolicy.sessionIdleMs / 1000,
    );
    const { expiresAt } = await root.authCredential.findUniqueOrThrow({
      where,
    });
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(
      authPolicy.sessionIdleMs - 60_000,
    );
    await root.authCredential.update({
      where,
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    await sessionProbe(user.id, cookie).expect(401);
  });

  it('rejects expired reset links and consumes valid links once, even with concurrent use', async () => {
    const user = a.users[2];
    const session = await login(user.email);
    const start = Date.now();
    await post('forgot-password', { email: user.email }).expect(200);
    const expired = latestEmailToken();
    const where = { digest: digest(expired) };
    const credential = await root.authCredential.findUniqueOrThrow({ where });
    expect(credential.expiresAt.getTime()).toBeGreaterThanOrEqual(
      start + authPolicy.resetMs,
    );
    expect(credential.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + authPolicy.resetMs,
    );
    await root.authCredential.update({
      where,
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    await post('reset-password', {
      token: expired,
      password: newPassword,
    }).expect(401);
    await post('forgot-password', { email: user.email }).expect(200);
    const token = latestEmailToken();
    const payload = {
      token,
      password: newPassword,
      tenantId: b.tenantId,
      userId: b.users[2].id,
    };
    await post('reset-password', {
      ...payload,
      password: 'onlyletters',
    }).expect(400);
    const responses = await Promise.all([
      post('reset-password', payload),
      post('reset-password', payload),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      204, 401,
    ]);
    await sessionProbe(user.id, session).expect(401);
    await login(user.email, newPassword);
    await login(b.users[2].email, otherPassword);
  });

  it('activates a pending account through the invitation email only', async () => {
    const user = b.users[1];
    await root.user.update({
      where: { id: user.id },
      data: { status: 'PENDING' },
    });
    await post('login', {
      identifier: user.email,
      password: otherPassword,
    }).expect(401);
    const auth = app.get(AuthService);
    expect(await auth.invite(user.email, codeA)).toBe(false);
    await post('forgot-password', { email: user.email }).expect(200);
    expect(send).not.toHaveBeenCalled();
    expect(await auth.invite(user.email, codeB)).toBe(true);
    const token = latestEmailToken();
    expect(send).toHaveBeenCalledWith(user.email, 'INVITE', token);
    await post('reset-password', { token, password: newPassword }).expect(401);
    const payload = {
      token,
      mode: 'invite',
      password: newPassword,
      tenantId: a.tenantId,
    };
    await post('reset-password', payload).expect(204);
    await post('reset-password', payload).expect(401);
    await login(user.email, newPassword);
    expect(
      await root.auditLog.count({
        where: {
          userId: user.id,
          tenantId: b.tenantId,
          action: 'ACTIVATE_USER',
        },
      }),
    ).toBe(1);
    expect(
      await root.user.findUnique({ where: { id: a.users[1].id } }),
    ).toMatchObject({ tenantId: a.tenantId, status: 'ACTIVE' });
  });

  it('disambiguates duplicate identifiers without granting access across companies', async () => {
    const aUser = a.users[2];
    const bUser = b.users[2];
    const aPassword = (
      await root.user.findUniqueOrThrow({ where: { id: aUser.id } })
    ).passwordHash;
    const inputPassword = (await verify(aPassword, password))
      ? password
      : newPassword;
    await root.user.update({
      where: { id: bUser.id },
      data: { email: aUser.email },
    });
    try {
      await post('login', {
        identifier: aUser.email,
        password: inputPassword,
        tenantId: a.tenantId,
      }).expect(401);
      await post('login', {
        identifier: aUser.email,
        password: otherPassword,
        companyCode: codeA,
      }).expect(401);
      const aCookie = await login(aUser.email, inputPassword, codeA);
      const bCookie = await login(aUser.email, otherPassword, codeB);
      await sessionProbe(aUser.id, aCookie).expect(200, { id: aUser.id });
      await sessionProbe(bUser.id, aCookie).expect(200, { id: null });
      await sessionProbe(aUser.id, bCookie).expect(200, { id: null });
      const database = app.get(TenantDatabase);
      const where = { digest: digest(tokenFromCookie(bCookie)) };
      await database.runAuth(a.tenantId, async () => {
        expect(
          await database.client.authCredential.findUnique({ where }),
        ).toBeNull();
        expect(
          await database.client.authCredential.deleteMany({ where }),
        ).toEqual({ count: 0 });
      });
      await sessionProbe(bUser.id, bCookie).expect(200, { id: bUser.id });
      const response = await post(
        'forgot-password',
        { email: b.users[0].email, companyCode: codeA, tenantId: b.tenantId },
        aCookie,
      ).expect(200);
      await post('forgot-password', { email: aUser.email }, aCookie).expect(
        200,
        response.body,
      );
      expect(send).not.toHaveBeenCalled();
    } finally {
      await root.user.update({
        where: { id: bUser.id },
        data: { email: bUser.email },
      });
    }
  });

  it('changes the password and revokes all sessions for the cookie owner only', async () => {
    const aUser = a.users[0];
    const bUser = b.users[0];
    const aCookie = await login(aUser.email);
    const aSecond = await login(aUser.email);
    const bCookie = await login(bUser.email, otherPassword);
    const payload = {
      password: newPassword,
      tenantId: b.tenantId,
      userId: bUser.id,
    };
    await post(
      'change-password',
      { ...payload, currentPassword: otherPassword },
      aCookie,
    ).expect(401);
    await post(
      'change-password',
      { ...payload, currentPassword: password },
      aCookie,
    ).expect(204);
    await sessionProbe(aUser.id, aSecond).expect(401);
    await sessionProbe(bUser.id, bCookie).expect(200, { id: bUser.id });
    await post('login', { identifier: aUser.email, password }).expect(401);
    await login(aUser.email, newPassword);
    await login(bUser.email, otherPassword);
  });

  it('signs every device out for the authenticated user and rejects cross-origin writes', async () => {
    const user = a.users[1];
    const cookie = await login(user.email);
    const second = await login(user.email);
    const bCookie = await login(b.users[0].email, otherPassword);
    await request(app.getHttpServer())
      .post('/auth/logout-all')
      .set('Origin', 'https://example.org')
      .set('Cookie', cookie)
      .expect(403);
    await post(
      'logout-all',
      { userId: b.users[0].id, tenantId: b.tenantId },
      cookie,
    ).expect(204);
    await sessionProbe(user.id, cookie).expect(401);
    await sessionProbe(user.id, second).expect(401);
    await sessionProbe(b.users[0].id, bCookie).expect(200, {
      id: b.users[0].id,
    });
  });

  it('T05 / AC-01: isolates /me and scoped guard permissions under PostgreSQL RLS', async () => {
    const trainer = a.users[1];
    const colleague = a.users[2];
    const foreign = b.users[0];
    const assignment = await root.userRole.create({
      data: {
        tenantId: a.tenantId,
        userId: trainer.id,
        role: 'PTDT',
        departmentIds: [a.department.id],
      },
    });
    const cookie = await login(trainer.email);
    const api = request(app.getHttpServer());

    const profile = await api
      .get('/me')
      .query({
        userId: foreign.id,
        tenantId: b.tenantId,
      })
      .set('Cookie', cookie)
      .expect(200);
    expect(profile.body).toMatchObject({
      id: trainer.id,
      tenantId: a.tenantId,
      roles: ['NV', 'PTDT'],
      profile: {
        fullName: trainer.fullName,
        email: trainer.email,
        phone: trainer.phone,
        tenantName: expect.stringMatching(/^Doanh nghiệp /),
      },
    });
    expect(profile.body.permissions).toContainEqual({
      permission: 'training.report',
      scope: 'departments',
      departmentIds: [a.department.id],
    });
    const foreignTenant = await root.tenant.findUniqueOrThrow({
      where: { id: b.tenantId },
    });
    expect(JSON.stringify(profile.body)).not.toContain(b.department.id);
    expect(JSON.stringify(profile.body)).not.toContain(foreign.email);
    expect(profile.body.profile.tenantName).not.toBe(foreignTenant.name);
    expect(profile.body.profile).not.toHaveProperty('passwordHash');

    const report = (id: string) =>
      api.get('/test-session/report/' + id).set('Cookie', cookie);
    await report(colleague.id).expect(200);
    await report(foreign.id).expect(403);

    const otherDepartment = await root.department.create({
      data: { tenantId: a.tenantId, name: 'Kiểm thử phạm vi' },
    });
    await root.user.update({
      where: { id: colleague.id },
      data: { departmentId: otherDepartment.id },
    });
    await report(colleague.id).expect(403);

    await root.userRole.update({
      where: { id: assignment.id },
      data: { deletedAt: new Date() },
    });
    await report(colleague.id).expect(403);
    await report(trainer.id).expect(200);

    await root.user.update({
      where: { id: colleague.id },
      data: { managerId: trainer.id },
    });
    const manager = await api.get('/me').set('Cookie', cookie).expect(200);
    expect(manager.body.roles).toEqual(['NV']);
    expect(manager.body.permissions).toContainEqual({
      permission: 'training.report',
      scope: 'directReports',
    });
    await report(colleague.id).expect(200);
    await report(foreign.id).expect(403);

    const database = app.get(TenantDatabase);
    await database.runAuth(a.tenantId, async () => {
      await database.client
        .$queryRaw`SELECT set_config('app.auth_user_id', ${trainer.id}, true)`;
      const roles = await database.client.userRole.findMany({
        select: { userId: true, role: true },
      });
      expect(roles).toEqual([{ userId: trainer.id, role: 'NV' }]);
      await expect(
        database.client.userRole.updateMany({
          where: { userId: foreign.id },
          data: { departmentIds: [] },
        }),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it('supports QTNT sessions without exposing customer rows through the normal role', async () => {
    const cookie = await login(platformId + '@platform.example');
    await sessionProbe(a.users[0].id, cookie).expect(200, { id: null });
    const profile = await request(app.getHttpServer())
      .get('/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(profile.body).toMatchObject({
      id: platformId,
      tenantId: null,
      roles: ['QTNT'],
      profile: { email: platformId + '@platform.example', tenantName: null },
    });
    expect(profile.body.permissions).toContainEqual({
      permission: 'platform.manage',
      scope: 'platform',
    });
    expect(profile.body.permissions).not.toContainEqual(
      expect.objectContaining({ permission: 'organization.read' }),
    );
    await post('logout-all', {}, cookie).expect(204);
    await sessionProbe(a.users[0].id, cookie).expect(401);
  });
});
