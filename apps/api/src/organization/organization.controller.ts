import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthOriginGuard, type SessionRequest } from '../auth/auth-http';
import { RequirePermission } from '../auth/authorization.guard';
import { OrganizationService } from './organization.service';

const catalogId = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Mã danh mục không hợp lệ.'),
});

function actor(request: SessionRequest) {
  // Both organization permissions require a tenant account.
  return { id: request.user!.id, tenantId: request.user!.tenantId! };
}

@Controller('organization')
export class OrganizationController {
  constructor(
    @Inject(OrganizationService)
    private readonly organization: OrganizationService,
  ) {}

  @Get()
  @RequirePermission('organization.read')
  dashboard(@Req() request: SessionRequest) {
    return this.organization.dashboard(actor(request));
  }

  @Patch('profile')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('organization.manage')
  profile(@Body() body: unknown, @Req() request: SessionRequest) {
    return this.organization.saveProfile(actor(request), body);
  }

  @Patch('config')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('organization.manage')
  config(@Body() body: unknown, @Req() request: SessionRequest) {
    return this.organization.saveConfig(actor(request), body);
  }

  @Post('departments')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('organization.manage')
  createDepartment(@Body() body: unknown, @Req() request: SessionRequest) {
    return this.organization.saveCatalog(actor(request), 'departments', body);
  }

  @Patch('departments/:id')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('organization.manage')
  updateDepartment(
    @Param('id', catalogId) id: string,
    @Body() body: unknown,
    @Req() request: SessionRequest,
  ) {
    return this.organization.saveCatalog(
      actor(request),
      'departments',
      body,
      id.toLowerCase(),
    );
  }

  @Post('positions')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('organization.manage')
  createPosition(@Body() body: unknown, @Req() request: SessionRequest) {
    return this.organization.saveCatalog(actor(request), 'positions', body);
  }

  @Patch('positions/:id')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('organization.manage')
  updatePosition(
    @Param('id', catalogId) id: string,
    @Body() body: unknown,
    @Req() request: SessionRequest,
  ) {
    return this.organization.saveCatalog(
      actor(request),
      'positions',
      body,
      id.toLowerCase(),
    );
  }
}
