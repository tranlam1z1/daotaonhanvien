import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, type Prisma } from '@prisma/client';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A transaction-bound client: never expose the unscoped root client to handlers. */
@Injectable()
export class TenantDatabase implements OnModuleDestroy {
  private readonly prisma = new PrismaClient();
  private readonly context = new AsyncLocalStorage<Prisma.TransactionClient>();

  get client(): Prisma.TransactionClient {
    const client = this.context.getStore();
    if (!client) throw new Error('Tenant transaction is required');
    return client;
  }

  async run<T>(tenantId: string | null, work: () => Promise<T>): Promise<T> {
    return this.runScoped('educore36_tenant', tenantId, work);
  }

  /** Used only by authentication to resolve credentials and maintain sessions. */
  async runAuth<T>(
    tenantId: string | null,
    work: () => Promise<T>,
  ): Promise<T> {
    return this.runScoped('educore36_auth', tenantId, work);
  }

  /** Restricted to platform management after its HTTP permission guard. */
  async runPlatform<T>(
    tenantId: string | null,
    work: () => Promise<T>,
  ): Promise<T> {
    return this.runScoped('educore36_platform', tenantId, work);
  }

  private async runScoped<T>(
    role: 'educore36_tenant' | 'educore36_auth' | 'educore36_platform',
    tenantId: string | null,
    work: () => Promise<T>,
  ): Promise<T> {
    if (tenantId !== null && !UUID.test(tenantId)) {
      throw new Error('Invalid trusted tenant identity');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
      await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId ?? ''}, true)`;
      return this.context.run(tx, work);
    });
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
