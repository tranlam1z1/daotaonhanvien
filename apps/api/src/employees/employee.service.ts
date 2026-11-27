import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { argon2id, hash } from 'argon2';
import { newSecret } from '../auth/auth-policy';
import { TenantDatabase } from '../tenant/tenant-database';
import {
  objectInput,
  parseEmployee,
  parseRoles,
  type EmployeeInput,
} from './employee-input';
import { employeeQuota } from './employee-quota';

export type EmployeeActor = { id: string; tenantId: string; ip?: string };

const fields = {
  id: true,
  employeeCode: true,
  fullName: true,
  email: true,
  phone: true,
  departmentId: true,
  positionId: true,
  managerId: true,
  joinedAt: true,
  status: true,
  invitationRequired: true,
  roles: {
    where: { deletedAt: null },
    select: { role: true, departmentIds: true },
    orderBy: { role: 'asc' as const },
  },
} as const;

const catalogFields = { id: true, name: true, status: true } as const;
const activeAdmin = {
  status: 'ACTIVE',
  invitationRequired: false,
  roles: { some: { role: 'ADM', deletedAt: null } },
} as const;
const quotaMessage =
  'Đã đạt giới hạn tài khoản của gói. Không thể kích hoạt thêm tài khoản.';

@Injectable()
export class EmployeeService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}
  private get db() {
    return this.database.client;
  }

  async directory({ tenantId }: EmployeeActor) {
    const scope = { tenantId, deletedAt: null };
    const [employees, departments, positions] = await Promise.all([
      this.db.user.findMany({
        where: scope,
        select: fields,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      }),
      this.db.department.findMany({
        where: scope,
        select: catalogFields,
        orderBy: { name: 'asc' },
      }),
      this.db.position.findMany({
        where: scope,
        select: catalogFields,
        orderBy: { name: 'asc' },
      }),
    ]);
    return { employees, departments, positions };
  }

  async list(actor: EmployeeActor) {
    const [directory, quota] = await Promise.all([
      this.directory(actor),
      employeeQuota(this.db, actor.tenantId),
    ]);
    const { accounts, maxAccounts, accountWarning, storageWarning } = quota;
    return {
      ...directory,
      quota: { accounts, maxAccounts, accountWarning, storageWarning },
    };
  }

  async save(actor: EmployeeActor, body: unknown, id?: string) {
    const data = parseEmployee(body);
    await this.lock(actor);
    const directory = await this.directory(actor);
    const current = id
      ? directory.employees.find((employee) => employee.id === id)
      : undefined;
    if (id && !current)
      throw new NotFoundException('Không tìm thấy nhân viên.');
    this.validate(data, directory, await this.employeeKeys(actor), current);
    if (!current) {
      return this.db.user.create({
        data: {
          ...data,
          tenantId: actor.tenantId,
          invitationRequired: true,
          passwordHash: await hash(newSecret(), { type: argon2id }),
          createdBy: actor.id,
          updatedBy: actor.id,
          roles: {
            create: {
              tenantId: actor.tenantId,
              role: 'NV',
              createdBy: actor.id,
              updatedBy: actor.id,
            },
          },
        },
        select: fields,
      });
    }
    const employee = await this.db.user.update({
      where: { id: current.id },
      data: { ...data, updatedBy: actor.id },
      select: fields,
    });
    if (current.email !== data.email)
      await this.db.authCredential.deleteMany({
        where: { userId: current.id, kind: { in: ['RESET', 'INVITE'] } },
      });
    return employee;
  }

  async import(
    actor: EmployeeActor,
    rows: { row: number; fields: unknown }[],
    commit: boolean,
  ) {
    if (commit) await this.lock(actor);
    const directory = await this.directory(actor);
    const keys = await this.employeeKeys(actor);
    const errors: { row: number; message: string }[] = [];
    const valid: EmployeeInput[] = [];
    const emails = new Set<string>();
    const codes = new Set<string>();

    for (const { row, fields } of rows) {
      try {
        const data = parseEmployee(fields);
        this.validate(data, directory, keys);
        if (
          emails.has(data.email) ||
          codes.has(data.employeeCode.toLowerCase())
        )
          throw new BadRequestException(
            'Email hoặc mã nhân viên trùng trong tệp.',
          );
        emails.add(data.email);
        codes.add(data.employeeCode.toLowerCase());
        valid.push(data);
      } catch (error) {
        if (!(
          error instanceof BadRequestException ||
          error instanceof ConflictException
        ))
          throw error;
        errors.push({ row, message: error.message });
      }
    }
    if (!commit || errors.length)
      return { rows: rows.length, errors, imported: 0 };

    // A batch uses one unguessable, discarded password. Each account must set its own.
    const passwordHash = await hash(newSecret(), { type: argon2id });
    const users = await this.db.user.createManyAndReturn({
      data: valid.map((data) => ({
        ...data,
        tenantId: actor.tenantId,
        passwordHash,
        invitationRequired: true,
        createdBy: actor.id,
        updatedBy: actor.id,
      })),
      select: { id: true },
    });
    await this.db.userRole.createMany({
      data: users.map(({ id: userId }) => ({
        tenantId: actor.tenantId,
        userId,
        role: 'NV',
        createdBy: actor.id,
        updatedBy: actor.id,
      })),
    });
    return { rows: rows.length, errors, imported: users.length };
  }

  async roles(actor: EmployeeActor, id: string, body: unknown) {
    const roles = parseRoles(body);
    await this.lock(actor);
    const employee = await this.find(actor, id);
    if (!roles.some(({ role }) => role === 'ADM'))
      await this.keepAdmin(actor, employee);

    const allowed = await this.db.department.findMany({
      where: { tenantId: actor.tenantId, deletedAt: null },
      select: { id: true },
    });
    const departmentIds = new Set(allowed.map(({ id }) => id));
    if (
      roles.some((role) =>
        role.departmentIds.some((id) => !departmentIds.has(id)),
      )
    )
      throw new BadRequestException('Phạm vi có phòng ban không hợp lệ.');

    const assigned = roles.map(({ role }) => role);
    await this.db.userRole.updateMany({
      where: {
        tenantId: actor.tenantId,
        userId: id,
        deletedAt: null,
        role: { in: ['ADM', 'PTDT', 'PD'], notIn: assigned },
      },
      data: { deletedAt: new Date(), updatedBy: actor.id },
    });
    for (const { role, departmentIds } of roles) {
      await this.db.userRole.upsert({
        where: { userId_role: { userId: id, role } },
        create: {
          tenantId: actor.tenantId,
          userId: id,
          role,
          departmentIds,
          createdBy: actor.id,
          updatedBy: actor.id,
        },
        update: { departmentIds, deletedAt: null, updatedBy: actor.id },
      });
    }
    await this.audit(
      actor,
      id,
      'CHANGE_USER_ROLES',
      { roles: employee.roles },
      { roles },
    );
    return this.find(actor, id);
  }

  async activate(actor: EmployeeActor, id: string) {
    await this.lock(actor);
    const employee = await this.find(actor, id);
    if (
      employee.status === 'HANDOVER' ||
      (employee.status === 'ACTIVE' && !employee.invitationRequired)
    )
      return { kind: 'unchanged' } as const;

    // Retries resend the invitation for the already reserved account.
    if (employee.status === 'ACTIVE') return { kind: 'invite' } as const;
    const quota = await employeeQuota(this.db, actor.tenantId);
    if (quota.maxAccounts === null || !quota.subscriptionId)
      throw new ConflictException('Doanh nghiệp chưa có gói thuê bao.');
    if (quota.accounts >= quota.maxAccounts) {
      const admins = await this.db.user.findMany({
        where: { tenantId: actor.tenantId, deletedAt: null, ...activeAdmin },
        select: { email: true },
      });
      return {
        kind: 'blocked',
        ...quota,
        maxAccounts: quota.maxAccounts,
        admins: admins.map(({ email }) => email),
      } as const;
    }
    await this.db.user.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        invitationRequired: true,
        failedLogins: 0,
        lockedUntil: null,
        updatedBy: actor.id,
      },
    });
    await this.db.authCredential.deleteMany({ where: { userId: id } });
    await this.db.subscription.updateMany({
      where: {
        id: quota.subscriptionId,
        billableAccounts: { lt: quota.accounts + 1 },
      },
      data: { billableAccounts: quota.accounts + 1, updatedBy: actor.id },
    });
    await this.audit(
      actor,
      id,
      'ACTIVATE_USER',
      { status: employee.status },
      { status: 'ACTIVE' },
    );
    return { kind: 'invite' } as const;
  }

  async disable(actor: EmployeeActor, id: string, body: unknown) {
    const { reason } = objectInput(body);
    const note = typeof reason === 'string' ? reason.trim() : '';
    await this.lock(actor);
    const employee = await this.find(actor, id);
    if (employee.status === 'DISABLED') return employee;
    if (note.length > 500 || (employee.status === 'HANDOVER' && !note))
      throw new BadRequestException(
        'Vui lòng nhập lý do vô hiệu hóa, tối đa 500 ký tự.',
      );
    await this.keepAdmin(actor, employee);
    const updated = await this.db.user.update({
      where: { id },
      data: { status: 'DISABLED', updatedBy: actor.id },
      select: fields,
    });
    await this.db.authCredential.deleteMany({ where: { userId: id } });
    await this.audit(
      actor,
      id,
      'DISABLE_USER',
      { status: employee.status },
      { status: updated.status, reason: note },
    );
    return updated;
  }

  async remove(actor: EmployeeActor, id: string) {
    await this.lock(actor);
    const employee = await this.find(actor, id);
    if (employee.status !== 'PENDING' && employee.status !== 'DISABLED')
      throw new ConflictException('Hãy vô hiệu hóa tài khoản trước khi xóa.');
    const report = await this.db.user.findFirst({
      where: { tenantId: actor.tenantId, managerId: id, deletedAt: null },
      select: { id: true },
    });
    if (report)
      throw new ConflictException(
        'Hãy chuyển cấp dưới sang quản lý khác trước khi xóa.',
      );
    await this.db.user.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actor.id },
    });
    await this.db.authCredential.deleteMany({ where: { userId: id } });
    await this.audit(
      actor,
      id,
      'DELETE_USER',
      { status: employee.status },
      { status: 'DELETED' },
    );
    return { id };
  }

  private employeeKeys({ tenantId }: EmployeeActor) {
    return this.db.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, employeeCode: true },
    });
  }

  private async find({ tenantId }: EmployeeActor, id: string) {
    const employee = await this.db.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: fields,
    });
    if (!employee) throw new NotFoundException('Không tìm thấy nhân viên.');
    return employee;
  }

  private async lock(actor: EmployeeActor) {
    // Shared row lock with subscription changes and all employee mutations.
    await this.db
      .$queryRaw`SELECT id FROM tenants WHERE id = ${actor.tenantId}::uuid FOR UPDATE`;
    const admin = await this.db.user.findFirst({
      where: {
        id: actor.id,
        tenantId: actor.tenantId,
        deletedAt: null,
        ...activeAdmin,
        tenant: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true },
    });
    if (!admin)
      throw new ForbiddenException('Bạn không có quyền quản lý nhân viên.');
  }

  private async keepAdmin(
    actor: EmployeeActor,
    employee: Awaited<ReturnType<EmployeeService['find']>>,
  ) {
    if (
      employee.status === 'ACTIVE' &&
      !employee.invitationRequired &&
      employee.roles.some(({ role }) => role === 'ADM') &&
      !(await this.db.user.findFirst({
        where: {
          tenantId: actor.tenantId,
          deletedAt: null,
          id: { not: employee.id },
          ...activeAdmin,
        },
        select: { id: true },
      }))
    )
      throw new ConflictException(
        'Doanh nghiệp phải có ít nhất một quản trị viên đang kích hoạt.',
      );
  }

  private validate(
    data: EmployeeInput,
    directory: Awaited<ReturnType<EmployeeService['directory']>>,
    keys: Awaited<ReturnType<EmployeeService['employeeKeys']>>,
    current?: Awaited<ReturnType<EmployeeService['find']>>,
  ) {
    if (
      keys.some(
        (employee) =>
          employee.id !== current?.id &&
          (employee.email.toLowerCase() === data.email ||
            employee.employeeCode?.toLowerCase() ===
              data.employeeCode.toLowerCase()),
      )
    )
      throw new ConflictException('Email hoặc mã nhân viên đã tồn tại.');
    if (
      data.departmentId &&
      !directory.departments.some(
        (item) =>
          item.id === data.departmentId &&
          (item.status === 'ACTIVE' || item.id === current?.departmentId),
      )
    )
      throw new BadRequestException('Phòng ban không hợp lệ.');
    if (
      data.positionId &&
      !directory.positions.some(
        (item) =>
          item.id === data.positionId &&
          (item.status === 'ACTIVE' || item.id === current?.positionId),
      )
    )
      throw new BadRequestException('Chức danh không hợp lệ.');

    if (!data.managerId || data.managerId === current?.managerId) return;
    const managers = new Map(
      directory.employees.map((employee) => [employee.id, employee]),
    );
    if (!managers.has(data.managerId))
      throw new BadRequestException('Quản lý trực tiếp không hợp lệ.');
    const visited = new Set([current?.id]);
    let managerId: string | null = data.managerId;
    while (managerId) {
      if (visited.has(managerId))
        throw new BadRequestException('Quản lý trực tiếp tạo vòng lặp.');
      visited.add(managerId);
      managerId = managers.get(managerId)?.managerId ?? null;
    }
  }

  private audit(
    actor: EmployeeActor,
    objectId: string,
    action: string,
    before:
      | { status: string }
      | { roles: { role: string; departmentIds: string[] }[] },
    after:
      | { status: string; reason?: string }
      | { roles: { role: string; departmentIds: string[] }[] },
  ) {
    return this.db.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        userId: actor.id,
        action,
        objectType: 'User',
        objectId,
        before,
        after,
        ip: actor.ip,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });
  }
}

export { quotaMessage };
