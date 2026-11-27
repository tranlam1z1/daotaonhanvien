import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { TenantInterceptor } from './tenant.interceptor';
import { TenantDatabase } from './tenant-database';

describe('TenantInterceptor: trusted session boundary', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const foreignId = '22222222-2222-4222-8222-222222222222';
  const context = (request: object) =>
    ({
      getClass: () => class TestController {},
      getHandler: () => () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;
  const run = jest.fn(
    async (_tenant: string | null, work: () => Promise<unknown>) => work(),
  );
  const interceptor = new TenantInterceptor({
    run,
  } as unknown as TenantDatabase);
  const handler: CallHandler = { handle: () => of('ok') };

  beforeEach(() => run.mockClear());

  it('takes tenant identity only from the verified server session', async () => {
    const response = interceptor.intercept(
      context({
        user: { tenantId },
        body: { tenantId: foreignId, tenant_id: foreignId },
        query: { tenantId: foreignId, tenant_id: foreignId },
        headers: { 'x-tenant-id': foreignId },
      }),
      handler,
    );
    expect(await lastValueFrom(response)).toBe('ok');
    expect(run).toHaveBeenCalledWith(tenantId, expect.any(Function));
  });
  it('keeps QTNT without a tenant in a fail-closed transaction', async () => {
    expect(
      await lastValueFrom(
        interceptor.intercept(context({ user: { tenantId: null } }), handler),
      ),
    ).toBe('ok');
    expect(run).toHaveBeenCalledWith(null, expect.any(Function));
  });
  it('does not create tenant context from anonymous client input', async () => {
    await lastValueFrom(
      interceptor.intercept(
        context({ body: { tenantId }, query: { tenant_id: tenantId } }),
        handler,
      ),
    );
    expect(run).not.toHaveBeenCalled();
  });
  it('propagates handler errors to the transaction for rollback', async () => {
    await expect(
      lastValueFrom(
        interceptor.intercept(context({ user: { tenantId } }), {
          handle: () => throwError(() => new Error('Handler failed')),
        }),
      ),
    ).rejects.toThrow('Handler failed');
  });
  it('rejects malformed trusted identities before connecting to PostgreSQL', async () => {
    const database = new TenantDatabase();
    try {
      await expect(database.run('invalid', async () => null)).rejects.toThrow(
        'Invalid trusted tenant identity',
      );
    } finally {
      await database.onModuleDestroy();
    }
  });
});
