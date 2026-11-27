import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LeadStatus } from '@prisma/client';
import { AuthOriginGuard, type SessionRequest } from '../auth/auth-http';
import { authField } from '../auth/auth-policy';
import { RequirePermission } from '../auth/authorization.guard';
import { UsePlatformTransaction } from '../tenant/tenant.interceptor';
import { choice, uuid } from './platform-input';
import { PlatformService } from './platform.service';

function actor(request: SessionRequest) {
  return { id: request.user!.id, ip: request.ip };
}

@Controller('platform')
@UsePlatformTransaction()
export class PlatformController {
  constructor(
    @Inject(PlatformService) private readonly platform: PlatformService,
  ) {}

  @Get('companies')
  @RequirePermission('platform.manage')
  companies() {
    return this.platform.companies();
  }

  @Post('companies')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('platform.manage')
  createCompany(@Body() body: unknown, @Req() request: SessionRequest) {
    return this.platform.createCompany(body, actor(request));
  }

  @Patch('companies/:id')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('platform.manage')
  updateCompany(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: SessionRequest,
  ) {
    return this.platform.updateCompany(uuid(id), body, actor(request));
  }

  @Patch('companies/:id/status')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('platform.manage')
  status(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: SessionRequest,
  ) {
    return this.platform.setCompanyStatus(uuid(id), body, actor(request));
  }

  @Post('companies/:id/invitation')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('platform.manage')
  invite(@Param('id') id: string) {
    return this.platform.inviteAgain(uuid(id));
  }

  @Get('plans')
  @RequirePermission('platform.manage')
  plans() {
    return this.platform.plans();
  }

  @Post('plans')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('platform.manage')
  createPlan(@Body() body: unknown, @Req() request: SessionRequest) {
    return this.platform.savePlan(body, actor(request));
  }

  @Patch('plans/:id')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('platform.manage')
  updatePlan(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: SessionRequest,
  ) {
    return this.platform.savePlan(body, actor(request), uuid(id));
  }

  @Get('companies/:id/subscriptions')
  @RequirePermission('platform.manage')
  billing(@Param('id') id: string) {
    return this.platform.billing(uuid(id));
  }

  @Post('companies/:id/subscriptions')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('platform.manage')
  assign(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: SessionRequest,
  ) {
    return this.platform.assignPlan(uuid(id), body, actor(request));
  }

  @Patch('companies/:id/subscriptions/:subscriptionId')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('platform.manage')
  renew(
    @Param('id') id: string,
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: unknown,
    @Req() request: SessionRequest,
  ) {
    return this.platform.renew(
      uuid(id),
      uuid(subscriptionId),
      body,
      actor(request),
    );
  }

  @Post('companies/:id/subscriptions/:subscriptionId/payments')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('platform.manage')
  payment(
    @Param('id') id: string,
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: unknown,
    @Req() request: SessionRequest,
  ) {
    return this.platform.recordPayment(
      uuid(id),
      uuid(subscriptionId),
      body,
      actor(request),
    );
  }

  @Get('leads')
  @RequirePermission('platform.manage')
  leads(@Query() query: unknown) {
    const status = authField(query, 'status', 20);
    const assignee = authField(query, 'assigneeId', 36);
    return this.platform.leads({
      status: status ? choice(LeadStatus, status) : undefined,
      assigneeId:
        assignee === 'unassigned'
          ? null
          : assignee
            ? uuid(assignee)
            : undefined,
      search: authField(query, 'search', 200).trim() || undefined,
    });
  }

  @Get('leads/:id')
  @RequirePermission('platform.manage')
  lead(@Param('id') id: string) {
    return this.platform.lead(uuid(id));
  }

  @Patch('leads/:id')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('platform.manage')
  updateLead(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: SessionRequest,
  ) {
    return this.platform.updateLead(uuid(id), body, actor(request));
  }
}
