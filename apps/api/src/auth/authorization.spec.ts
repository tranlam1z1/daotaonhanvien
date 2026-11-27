import 'reflect-metadata';
import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Role } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../app.module';
import { LeadInfrastructure } from '../leads/leads.infrastructure';
import { TenantDatabase } from '../tenant/tenant-database';
import { sessionCookie, webOrigin } from './auth-policy';
import { AuthService } from './auth.service';
import type { SessionIdentity } from './permissions';

const identities = new Map<string, SessionIdentity>(
  (['QTNT', 'ADM', 'PTDT', 'PD', 'NV'] as const).map((role) => [
    role,
    {
      id: 'account-' + role,
      tenantId: role === 'QTNT' ? null : 'tenant-a',
      status: 'ACTIVE',
      roles: [
        {
          role,
          departmentIds:
            role === 'PTDT' || role === 'PD' ? ['department-a'] : [],
        },
      ],
      hasDirectReports: false,
      profile: {
        fullName: 'Tài khoản ' + role,
        email: role.toLowerCase() + '@example.test',
        phone: null,
        tenantName: role === 'QTNT' ? null : 'Doanh nghiệp A',
      },
    },
  ]),
);

describe('T05 access matrix for existing HTTP endpoints', () => {
  let app: INestApplication;
  const auth = {
    authenticate: jest.fn(async (token: string) => {
      const identity = identities.get(token);
      if (!identity) throw new UnauthorizedException();
      return identity;
    }),
    login: jest.fn(async () => 'session'),
    requestReset: jest.fn(),
    setPassword: jest.fn(),
    changePassword: jest.fn(),
    logoutAll: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TenantDatabase)
      .useValue({
        run: jest.fn(async (_tenant: string, work: () => unknown) => work()),
      })
      .overrideProvider(LeadInfrastructure)
      .useValue({ consumeLimit: jest.fn(async () => 0) })
      .overrideProvider(AuthService)
      .useValue(auth)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app?.close());

  it.each<[Role | null, number]>([
    [null, 401],
    ['QTNT', 200],
    ['ADM', 200],
    ['PTDT', 200],
    ['PD', 200],
    ['NV', 200],
  ])(
    'grants public and account endpoints correctly for %s',
    async (role, profileStatus) => {
      const api = request(app.getHttpServer());
      const cookie = role ? sessionCookie + '=' + role : '';
      const post = (route: string) =>
        api.post(route).set('Origin', webOrigin()).set('Cookie', cookie);
      await api.get('/health').set('Cookie', cookie).expect(200);
      await post('/public/leads').send({ website: 'honeypot' }).expect(201);
      await post('/auth/login').send({}).expect(204);
      await post('/auth/forgot-password').send({}).expect(200);
      await post('/auth/reset-password').send({}).expect(204);
      await post('/auth/change-password')
        .send({})
        .expect(role ? 204 : 401);
      await post('/auth/logout-all')
        .send({})
        .expect(role ? 204 : 401);

      const profile = await api
        .get('/me')
        .set('Cookie', cookie)
        .expect(profileStatus);
      if (role) {
        expect(profile.body).toMatchObject({
          id: identities.get(role)?.id,
          roles: role === 'NV' || role === 'QTNT' ? [role] : ['NV', role],
        });
        expect(profile.headers['cache-control']).toBe('private, no-store');
      }
    },
  );

  it('does not use request-supplied identity or grants', async () => {
    const response = await request(app.getHttpServer())
      .get('/me?tenantId=tenant-b&userId=account-QTNT&role=ADM')
      .set('Cookie', sessionCookie + '=PTDT')
      .set('X-Tenant-Id', 'tenant-b')
      .set('X-Role', 'ADM')
      .expect(200);
    expect(response.body).toMatchObject({
      id: 'account-PTDT',
      tenantId: 'tenant-a',
      roles: ['NV', 'PTDT'],
      profile: { email: 'ptdt@example.test', tenantName: 'Doanh nghiệp A' },
    });
    expect(response.body.permissions).toContainEqual({
      permission: 'content.edit',
      scope: 'departments',
      departmentIds: ['department-a'],
    });
    expect(response.body.permissions).not.toContainEqual(
      expect.objectContaining({ permission: 'content.approve' }),
    );
  });
});
