import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
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
import { can } from '../auth/permissions';
import { handoverNotice } from '../handover/handover.controller';
import { readConfig } from '../organization/organization-input';
import { TenantDatabase } from '../tenant/tenant-database';
import { UseManualTenantTransaction } from '../tenant/tenant.interceptor';
import { EmployeeQuotaMailer } from './employee-quota';
import { EmployeeService, quotaMessage } from './employee.service';
import { dateInput, objectInput } from './employee-input';
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

  @Post(':id/handover')
  @RequirePermission('handover.start', async (client, request) => {
    const id = request.params.id;
    const tenantId = request.user!.tenantId;
    if (
      !tenantId ||
      typeof id !== 'string' ||
      !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)
    )
      return null;
    const employee = await client.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true, managerId: true },
    });
    return employee && { tenantId, employee };
  })
  @UseGuards(AuthOriginGuard)
  async startHandover(
    @Req() request: SessionRequest,
    @Param('id', employeeId) id: string,
    @Body() body: unknown,
  ) {
    const identity = actor(request);
    const fields = objectInput(body);
    const departureOn =
      typeof fields.departureOn === 'string'
        ? dateInput(fields.departureOn.trim(), 'Ngày nghỉ việc')
        : null;
    if (
      !departureOn ||
      Object.keys(fields).some((key) => key !== 'departureOn')
    )
      throw new BadRequestException('Vui lòng nhập ngày nghỉ việc hợp lệ.');

    const today = dateInput(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date()),
    )!;
    const db = this.database.client;
    await db.$queryRaw`SELECT id FROM tenants WHERE id = ${identity.tenantId}::uuid FOR UPDATE`;
    const employee = await db.user.findFirst({
      where: { id, tenantId: identity.tenantId, deletedAt: null },
      select: { id: true, managerId: true, status: true, leftAt: true },
    });
    if (
      !employee ||
      !can(request.user!, 'handover.start', {
        tenantId: identity.tenantId,
        employee,
      })
    )
      throw new ForbiddenException('Bạn không có quyền tạo hồ sơ bàn giao.');

    const existing = await db.handoverCase.findFirst({
      where: {
        tenantId: identity.tenantId,
        employeeId: employee.id,
        completedAt: null,
      },
    });
    if (existing && existing.departureOn.getTime() === departureOn.getTime())
      return existing;
    if (existing || employee.status !== 'ACTIVE')
      throw new ConflictException(
        'Không thể tạo hồ sơ bàn giao cho nhân viên này.',
      );

    const tenant = await db.tenant.findUniqueOrThrow({
      where: { id: identity.tenantId },
      select: { config: true },
    });
    const { handoverDays } = readConfig(tenant.config);
    const dueOn =
      handoverDays === null
        ? departureOn
        : new Date(today.getTime() + handoverDays * 86_400_000);
    if (!Number.isFinite(+dueOn) || dueOn.getUTCFullYear() > 9999)
      throw new BadRequestException(
        'Số ngày bàn giao trong cấu hình không hợp lệ.',
      );
    const isAdmin = await db.userRole.count({
      where: {
        tenantId: identity.tenantId,
        userId: employee.id,
        role: 'ADM',
        deletedAt: null,
      },
    });
    if (isAdmin) {
      const cutoff = dueOn < departureOn ? dueOn : departureOn;
      const alternative = await db.user.findFirst({
        where: {
          tenantId: identity.tenantId,
          id: { not: employee.id },
          deletedAt: null,
          status: 'ACTIVE',
          invitationRequired: false,
          roles: { some: { role: 'ADM', deletedAt: null } },
          OR: [
            { leftAt: null },
            {
              leftAt: { gt: cutoff },
              handoverCases: {
                none: { dueOn: { lte: cutoff }, completedAt: null },
              },
            },
          ],
        },
        select: { id: true },
      });
      if (!alternative)
        throw new ConflictException(
          'Doanh nghiệp phải có ít nhất một quản trị viên đang kích hoạt.',
        );
    }
    const result = await db.user.updateMany({
      where: {
        id: employee.id,
        tenantId: identity.tenantId,
        managerId: employee.managerId,
        status: 'ACTIVE',
        deletedAt: null,
        leftAt: employee.leftAt,
      },
      data: { leftAt: departureOn, updatedBy: identity.id },
    });
    if (!result.count)
      throw new ConflictException(
        'Thông tin nhân viên đã thay đổi. Vui lòng thử lại.',
      );
    const created = await db.handoverCase.create({
      data: {
        tenantId: identity.tenantId,
        employeeId: employee.id,
        departureOn,
        dueOn,
        createdBy: identity.id,
      },
    });
    await db.auditLog.create({
      data: {
        tenantId: identity.tenantId,
        userId: identity.id,
        action: 'handover.start',
        objectType: 'HandoverCase',
        objectId: created.id,
        ip: identity.ip,
        after: {
          employeeId: employee.id,
          departureOn: departureOn.toISOString(),
          dueOn: dueOn.toISOString(),
        },
      },
    });
    await handoverNotice(
      db,
      identity.tenantId,
      [employee.id, employee.managerId],
      `handover:${created.id}:start`,
      'Hồ sơ bàn giao nghỉ việc đã được khởi tạo.',
    );
    return created;
  }

  @Delete(':id')
  @RequirePermission('employees.manage')
  @UseGuards(AuthOriginGuard)
  remove(@Req() request: SessionRequest, @Param('id', employeeId) id: string) {
    return this.employees.remove(actor(request), id.toLowerCase());
  }
}
