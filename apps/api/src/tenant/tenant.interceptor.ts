import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { from, lastValueFrom } from 'rxjs';
import { TenantDatabase } from './tenant-database';

const platformTransaction = Symbol('platformTransaction');
export const UsePlatformTransaction = () =>
  SetMetadata(platformTransaction, true);
const manualTenantTransaction = Symbol('manualTenantTransaction');
export const UseManualTenantTransaction = () =>
  SetMetadata(manualTenantTransaction, true);

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<{
      user?: { tenantId: string | null };
    }>();
    // Public liveness/lead endpoints have no tenant data access. The database
    // getter still fails closed if an anonymous handler attempts a tenant query.
    if (
      !request.user ||
      Reflect.getMetadata(platformTransaction, context.getClass()) ||
      Reflect.getMetadata(manualTenantTransaction, context.getHandler())
    ) {
      return next.handle();
    }
    return from(
      this.database.run(request.user?.tenantId ?? null, () =>
        lastValueFrom(next.handle()),
      ),
    );
  }
}
