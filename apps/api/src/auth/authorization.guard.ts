import {
  applyDecorators,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Prisma } from '@prisma/client';
import { TenantDatabase } from '../tenant/tenant-database';
import { SessionGuard, type SessionRequest } from './auth-http';
import { can, type Permission, type PermissionContext } from './permissions';

type ResolveContext = (
  client: Prisma.TransactionClient,
  request: SessionRequest,
) => Promise<PermissionContext | null>;

const requirement = Reflector.createDecorator<{
  permission: Permission;
  resolve?: ResolveContext;
}>();

/** Resolve the target with tenant RLS. A missing target must resolve to null. */
export function RequirePermission(
  permission: Permission,
  resolve?: ResolveContext,
) {
  return applyDecorators(
    requirement({ permission, resolve }),
    UseGuards(SessionGuard, AuthorizationGuard),
  );
}

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  async canActivate(context: ExecutionContext) {
    const rule = this.reflector.get(requirement, context.getHandler());
    const request = context.switchToHttp().getRequest<SessionRequest>();
    if (!request.user)
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ.');
    const actor = request.user;
    const resolve = rule?.resolve;
    const resource = resolve
      ? await this.database.run(actor.tenantId, () =>
          resolve(this.database.client, request),
        )
      : undefined;
    if (!rule || resource === null || !can(actor, rule.permission, resource)) {
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện thao tác này.',
      );
    }
    return true;
  }
}
