import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthOriginGuard, type SessionRequest } from '../auth/auth-http';
import { RequirePermission } from '../auth/authorization.guard';
import { TenantDatabase } from '../tenant/tenant-database';
import { optionalEmailGroups } from './notice-email';

@Controller('notices')
export class NoticesController {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  @Get('preferences')
  @RequirePermission('session.profile')
  async preferences(@Req() request: SessionRequest) {
    const { tenantId, id } = request.user!;
    if (!tenantId) return [];
    const user = await this.database.client.user.findFirstOrThrow({
      where: { tenantId, id },
      select: { mutedEmailGroups: true },
    });
    return user.mutedEmailGroups;
  }

  @Patch('preferences')
  @RequirePermission('session.profile')
  @UseGuards(AuthOriginGuard)
  async setPreferences(@Req() request: SessionRequest, @Body() body: unknown) {
    const { tenantId, id } = request.user!;
    if (
      !tenantId ||
      !Array.isArray(body) ||
      body.length > optionalEmailGroups.length ||
      body.some(
        (value: unknown) =>
          typeof value !== 'string' ||
          !optionalEmailGroups.some((group) => group === value),
      )
    )
      throw new BadRequestException('Tùy chọn email không hợp lệ.');
    const values = [...new Set(body as string[])];
    await this.database.client.user.updateMany({
      where: { tenantId, id },
      data: { mutedEmailGroups: values },
    });
    return values;
  }

  @Get()
  @RequirePermission('session.profile')
  list(@Req() request: SessionRequest) {
    const { tenantId, id } = request.user!;
    if (!tenantId) return [];
    return this.database.client.workspaceNotice.findMany({
      where: { tenantId, userId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, message: true, createdAt: true, readAt: true },
    });
  }

  @Post(':id/read')
  @RequirePermission('session.profile')
  @UseGuards(AuthOriginGuard)
  async read(
    @Req() request: SessionRequest,
    @Param('id', ParseUUIDPipe) noticeId: string,
  ) {
    const { tenantId, id } = request.user!;
    if (tenantId)
      await this.database.client.workspaceNotice.updateMany({
        where: { id: noticeId, tenantId, userId: id, readAt: null },
        data: { readAt: new Date() },
      });
    return { ok: true };
  }
}
