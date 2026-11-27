import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthOriginGuard, type SessionRequest } from '../auth/auth-http';
import { AuthService } from '../auth/auth.service';
import { RequirePermission } from '../auth/authorization.guard';
import { TenantDatabase } from '../tenant/tenant-database';
import { UseManualTenantTransaction } from '../tenant/tenant.interceptor';
import { EmployeeQuotaMailer } from './employee-quota';
import { EmployeeService, quotaMessage } from './employee.service';
import {
  employeeTemplate,
  employeeUploadLimit,
  readEmployeeWorkbook,
} from './employee-workbook';

const employeeId = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Mã nhân viên không hợp lệ.'),
});

function actor(request: SessionRequest) {
  return {
    id: request.user!.id,
    tenantId: request.user!.tenantId!,
    ip: request.ip,
  };
}

@Controller('employees')
export class EmployeeController {
  constructor(
    @Inject(EmployeeService) private readonly employees: EmployeeService,
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(EmployeeQuotaMailer) private readonly mailer: EmployeeQuotaMailer,
  ) {}

  @Get()
  @RequirePermission('employees.manage')
  list(@Req() request: SessionRequest) {
    return this.employees.list(actor(request));
  }

  @Get('template')
  @RequirePermission('employees.manage')
  @UseManualTenantTransaction()
  async template(@Req() request: SessionRequest) {
    const identity = actor(request);
    const directory = await this.database.run(identity.tenantId, () =>
      this.employees.directory(identity),
    );
    return new StreamableFile(await employeeTemplate(directory), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="mau-nhap-nhan-vien.xlsx"',
    });
  }

  @Post('import')
  @RequirePermission('employees.manage')
  @UseGuards(AuthOriginGuard)
  @UseManualTenantTransaction()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: employeeUploadLimit, files: 1, fields: 0 },
    }),
  )
  async import(
    @Req() request: SessionRequest,
    @UploadedFile() file?: { buffer: Buffer },
    @Query('commit') commit?: string,
  ) {
    const identity = actor(request);
    const rows = await readEmployeeWorkbook(file?.buffer);
    return this.database.run(identity.tenantId, () =>
      this.employees.import(identity, rows, commit === 'true'),
    );
  }

  @Post()
  @RequirePermission('employees.manage')
  @UseGuards(AuthOriginGuard)
  create(@Req() request: SessionRequest, @Body() body: unknown) {
    return this.employees.save(actor(request), body);
  }

  @Patch(':id')
  @RequirePermission('employees.manage')
  @UseGuards(AuthOriginGuard)
  update(
    @Req() request: SessionRequest,
    @Param('id', employeeId) id: string,
    @Body() body: unknown,
  ) {
    return this.employees.save(actor(request), body, id.toLowerCase());
  }

  @Patch(':id/roles')
  @RequirePermission('employees.manage')
  @UseGuards(AuthOriginGuard)
  roles(
    @Req() request: SessionRequest,
    @Param('id', employeeId) id: string,
    @Body() body: unknown,
  ) {
    return this.employees.roles(actor(request), id.toLowerCase(), body);
  }

  @Post(':id/activate')
  @RequirePermission('employees.manage')
  @UseGuards(AuthOriginGuard)
  @UseManualTenantTransaction()
  async activate(
    @Req() request: SessionRequest,
    @Param('id', employeeId) param: string,
  ) {
    const identity = actor(request);
    const id = param.toLowerCase();
    const result = await this.database.run(identity.tenantId, () =>
      this.employees.activate(identity, id),
    );
    if (result.kind === 'blocked') {
      await this.mailer.blocked(
        result.companyName,
        result.admins,
        result.accounts,
        result.maxAccounts,
      );
      throw new ConflictException(quotaMessage);
    }
    if (result.kind === 'unchanged') return { invitationSent: null };
    return {
      invitationSent: await this.auth.invitePendingAccount(
        id,
        identity.tenantId,
      ),
    };
  }

  @Post(':id/disable')
  @RequirePermission('employees.manage')
  @UseGuards(AuthOriginGuard)
  disable(
    @Req() request: SessionRequest,
    @Param('id', employeeId) id: string,
    @Body() body: unknown,
  ) {
    return this.employees.disable(actor(request), id.toLowerCase(), body);
  }

  @Delete(':id')
  @RequirePermission('employees.manage')
  @UseGuards(AuthOriginGuard)
  remove(@Req() request: SessionRequest, @Param('id', employeeId) id: string) {
    return this.employees.remove(actor(request), id.toLowerCase());
  }
}
