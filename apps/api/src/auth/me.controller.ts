import { Controller, Get, Req } from '@nestjs/common';
import { type SessionRequest } from './auth-http';
import { RequirePermission } from './authorization.guard';
import { effectiveRoles, permissionProfile } from './permissions';

@Controller('me')
export class MeController {
  @Get()
  @RequirePermission('session.profile')
  me(@Req() request: SessionRequest) {
    const actor = request.user!;
    return {
      id: actor.id,
      tenantId: actor.tenantId,
      profile: actor.profile,
      roles: effectiveRoles(actor).map(({ role }) => role),
      permissions: permissionProfile(actor),
    };
  }
}
