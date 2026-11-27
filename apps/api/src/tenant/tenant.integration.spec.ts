import 'reflect-metadata';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { hash, verify } from 'argon2';
import { Controller, Get, Param, type INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { TenantDatabase } from './tenant-database';
import { TenantInterceptor } from './tenant.interceptor';
import {
  createTenantFixture,
  removeTenantFixture,
} from '../testing/tenant-fixture';
import { tenantIsolationContract } from '../testing/tenant-isolation-contract';

const integration =
  process.env.TENANT_INTEGRATION_TEST === 'true' ? describe : describe.skip;

// Test-only HTTP surface. No business endpoint is added to AppModule in T03.
@Controller('test-users')
class TenantProbeController {
  constructor(private readonly database: TenantDatabase) {}

  @Get(':id')
  async find(@Param('id') id: string) {
    const user = await this.database.client.user.findUnique({ where: { id } });
    return { id: user?.id ?? null };
  }
}

integration('T03: real PostgreSQL RLS', () => {
  const root = new PrismaClient();
  const database = new TenantDatabase();
  let a: Awaited<ReturnType<typeof createTenantFixture>>;
  let b: typeof a;
  const planId = randomUUID();
  const ids: Record<string, { a: string; b: string }> = {};
  const platformId = randomUUID();
  let passwordHash: string;
  let app: INestApplication;

  beforeAll(async () => {
    passwordHash = await hash('T03TestPassword36!');
    await root.user.create({
      data: {
        id: platformId,
        fullName: 'QTNT',
        email: `${platformId}@platform.example`,
        passwordHash,
        roles: { create: { role: 'QTNT' } },
      },
    });
    a = await createTenantFixture(root, passwordHash);
    b = await createTenantFixture(root, passwordHash);
    await root.plan.create({
      data: {
        id: planId,
        name: 'Test',
        maxAccounts: 10,
        storageGb: 1,
        price: 0,
        cycle: 'MONTHLY',
      },
    });
    for (const [key, fixture] of [
      ['a', a],
      ['b', b],
    ] as const) {
      const tenantId = fixture.tenantId;
      const subscription = await root.subscription.create({
        data: {
          tenantId,
          planId,
          startsAt: new Date('2026-01-01'),
          endsAt: new Date('2027-01-01'),
        },
      });
      const payment = await root.payment.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          amount: 100,
          paidAt: new Date(),
          recordedBy: platformId,
        },
      });
      const audit = await root.auditLog.create({
        data: {
          tenantId,
          userId: fixture.users[0].id,
          action: 'TEST',
          objectType: 'Tenant',
        },
      });
      const role = await root.userRole.findFirstOrThrow({
        where: { tenantId, userId: fixture.users[0].id },
      });
      for (const [model, id] of Object.entries({
        tenant: tenantId,
        department: fixture.department.id,
        position: fixture.position.id,
        user: fixture.users[0].id,
        userRole: role.id,
        subscription: subscription.id,
        payment: payment.id,
        auditLog: audit.id,
      })) {
        ids[model] ??= { a: '', b: '' };
        ids[model][key] = id;
      }
    }
    const module = await Test.createTestingModule({
      controllers: [TenantProbeController],
      providers: [
        { provide: TenantDatabase, useValue: database },
        { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
      ],
    }).compile();
    app = module.createNestApplication();
    // Emulate a verified server session; input headers/body never select a tenant.
    app.use(
      (
        req: Request & { user?: { tenantId: string | null } },
        _res: Response,
        next: NextFunction,
      ) => {
        req.user = { tenantId: a.tenantId };
        next();
      },
    );
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    if (a) await removeTenantFixture(root, a.tenantId);
    if (b) await removeTenantFixture(root, b.tenantId);
    await root.plan.deleteMany({ where: { id: planId } });
    await root.userRole.deleteMany({ where: { userId: platformId } });
    await root.user.deleteMany({ where: { id: platformId } });
    await database.onModuleDestroy();
    await root.$disconnect();
  });

  it('applies the real interceptor before HTTP handler queries and ignores forged client tenant input', async () => {
    await request(app.getHttpServer())
      .get(`/test-users/${a.users[0].id}`)
      .set('x-tenant-id', b.tenantId)
      .query({ tenant_id: b.tenantId })
      .expect(200)
      .expect({ id: a.users[0].id });
    await request(app.getHttpServer())
      .get(`/test-users/${b.users[0].id}`)
      .set('x-tenant-id', b.tenantId)
      .query({ tenant_id: b.tenantId })
      .expect(200)
      .expect({ id: null });
  });

  // A small common delegate surface keeps the contract reusable across models.
  type Delegate = {
    findMany: () => Promise<{ id: string }[]>;
    findUnique: (args: { where: { id: string } }) => Promise<unknown>;
    update: (args: {
      where: { id: string };
      data: { updatedBy: string };
    }) => Promise<unknown>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
  for (const model of [
    'tenant',
    'department',
    'position',
    'user',
    'userRole',
    'subscription',
    'payment',
    'auditLog',
  ] as const) {
    for (const direction of ['a', 'b'] as const) {
      tenantIsolationContract(`${model}, tenant ${direction}`, () => {
        const own = direction === 'a' ? a : b;
        const foreign = direction === 'a' ? b : a;
        const opposite = direction === 'a' ? 'b' : 'a';
        const delegate = () => database.client[model] as unknown as Delegate;
        const foreignData = {
          tenant: {
            id: randomUUID(),
            name: 'Forbidden',
            loginCode: randomUUID(),
          },
          department: { name: 'Forbidden' },
          position: { name: 'Forbidden' },
          user: {
            fullName: 'Forbidden',
            email: `${randomUUID()}@example.com`,
            passwordHash,
          },
          userRole: { userId: foreign.users[1].id, role: 'PD' },
          subscription: {
            planId,
            startsAt: new Date('2026-01-01'),
            endsAt: new Date('2027-01-01'),
          },
          payment: {
            subscriptionId: ids.subscription[opposite],
            amount: 1,
            paidAt: new Date(),
            recordedBy: platformId,
          },
          auditLog: { action: 'FORBIDDEN', objectType: 'Tenant' },
        };
        return {
          ownId: ids[model][direction],
          foreignId: ids[model][opposite],
          run: (work) => database.run(own.tenantId, work),
          list: () => delegate().findMany(),
          find: (id) => delegate().findUnique({ where: { id } }),
          update: (id) =>
            delegate().update({
              where: { id },
              data: { updatedBy: own.users[0].id },
            }),
          remove: (id) => delegate().delete({ where: { id } }),
          createForeign: () =>
            delegate().create({
              data: { ...foreignData[model], tenantId: foreign.tenantId },
            }),
        };
      });
    }
  }
  it('runs under a role without superuser, BYPASSRLS, table ownership or platform visibility', async () => {
    await database.run(a.tenantId, async () => {
      const roles = await database.client.$queryRaw<
        { rolsuper: boolean; rolbypassrls: boolean }[]
      >`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
      expect(roles).toEqual([{ rolsuper: false, rolbypassrls: false }]);
      const tables = await database.client.$queryRaw<
        {
          relname: string;
          relrowsecurity: boolean;
          relforcerowsecurity: boolean;
          owner: boolean;
        }[]
      >`SELECT relname, relrowsecurity, relforcerowsecurity,
          relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user) AS owner
        FROM pg_class WHERE relnamespace = 'public'::regnamespace
          AND relname IN ('tenants', 'subscriptions', 'payments', 'departments', 'positions', 'users', 'user_roles', 'audit_logs')`;
      expect(tables).toHaveLength(8);
      expect(
        tables.every(
          (table) =>
            table.relrowsecurity && table.relforcerowsecurity && !table.owner,
        ),
      ).toBe(true);
      expect(
        await database.client.user.findUnique({ where: { id: platformId } }),
      ).toBeNull();
      await expect(database.client.lead.findMany()).rejects.toThrow();
    });
  });
  it('fails closed without a session tenant, including QTNT', async () => {
    expect(() => database.client).toThrow('Tenant transaction is required');
    await database.run(null, async () => {
      expect(await database.client.user.findMany()).toEqual([]);
      expect(await database.client.tenant.findMany()).toEqual([]);
      expect(await database.client.auditLog.findMany()).toEqual([]);
    });
  });
  it('does not leak tenant context across concurrent requests or reused connections', async () => {
    await Promise.all(
      Array.from({ length: 12 }, (_, index) => {
        const fixture = index % 2 === 0 ? a : b;
        return database.run(fixture.tenantId, async () => {
          const users = await database.client.user.findMany();
          expect(users).toHaveLength(3);
          expect(
            users.every((user) => user.tenantId === fixture.tenantId),
          ).toBe(true);
        });
      }),
    );
    await database.run(null, async () =>
      expect(await database.client.user.count()).toBe(0),
    );
  });
  it('rolls back writes on request failure and clears context', async () => {
    const id = randomUUID();
    await expect(
      database.run(a.tenantId, async () => {
        await database.client.position.create({
          data: { id, tenantId: a.tenantId, name: 'Rollback' },
        });
        throw new Error('Request failed');
      }),
    ).rejects.toThrow('Request failed');
    expect(await root.position.findUnique({ where: { id } })).toBeNull();
    expect(() => database.client).toThrow();
  });
  it('rejects cross-tenant department, manager, role scope and actor references', async () => {
    const run = (work: () => Promise<unknown>) =>
      database.run(a.tenantId, work);
    await expect(
      run(() =>
        database.client.user.update({
          where: { id: a.users[0].id },
          data: { departmentId: b.department.id },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      run(() =>
        database.client.user.update({
          where: { id: a.users[0].id },
          data: { positionId: b.position.id },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      run(() =>
        database.client.user.update({
          where: { id: a.users[0].id },
          data: { managerId: b.users[0].id },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      run(() =>
        database.client.userRole.create({
          data: {
            tenantId: a.tenantId,
            userId: a.users[0].id,
            role: 'PD',
            departmentIds: [b.department.id],
          },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      run(() =>
        database.client.auditLog.create({
          data: {
            tenantId: a.tenantId,
            userId: b.users[0].id,
            action: 'TEST',
            objectType: 'User',
          },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      run(() =>
        database.client.department.update({
          where: { id: a.department.id },
          data: { parentId: b.department.id },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      run(() =>
        database.client.payment.create({
          data: {
            tenantId: a.tenantId,
            subscriptionId: ids.subscription.b,
            amount: 1,
            paidAt: new Date(),
            recordedBy: a.users[0].id,
          },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      run(() =>
        database.client.userRole.create({
          data: {
            tenantId: a.tenantId,
            userId: b.users[0].id,
            role: 'PTDT',
          },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      run(() =>
        database.client.position.update({
          where: { id: a.position.id },
          data: { tenantId: b.tenantId },
        }),
      ),
    ).rejects.toThrow();
  });
  it('permits own reads and writes, nested roles and valid scoped roles', async () => {
    await database.run(a.tenantId, async () => {
      const user = await database.client.user.findUniqueOrThrow({
        where: { id: a.users[0].id },
        include: { roles: true },
      });
      expect(user.roles.map((role) => role.role)).toContain('ADM');
      await database.client.userRole.create({
        data: {
          tenantId: a.tenantId,
          userId: user.id,
          role: 'PD',
          departmentIds: [a.department.id],
        },
      });
      const position = await database.client.position.create({
        data: { tenantId: a.tenantId, name: 'Own write' },
      });
      await database.client.position.update({
        where: { id: position.id },
        data: { name: 'Updated' },
      });
      await database.client.position.delete({ where: { id: position.id } });
    });
  });
  it('hashes bootstrap passwords with Argon2', async () => {
    expect(a.users[0].passwordHash).toMatch(/^\$argon2id\$/);
    expect(await verify(a.users[0].passwordHash, 'T03TestPassword36!')).toBe(
      true,
    );
  });
});
