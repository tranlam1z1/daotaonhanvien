import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type LeadStatus } from '@prisma/client';
import { hash, argon2id } from 'argon2';
import { newSecret } from '../auth/auth-policy';
import { AuthService } from '../auth/auth.service';
import { TenantDatabase } from '../tenant/tenant-database';
import * as input from './platform-input';

type Actor = { id: string; ip?: string };
const companyFields = {
  id: true,
  name: true,
  loginCode: true,
  taxCode: true,
  address: true,
  contactName: true,
  contactPhone: true,
  status: true,
} satisfies Prisma.TenantSelect;
const leadFields = {
  id: true,
  fullName: true,
  jobTitle: true,
  companyName: true,
  companySize: true,
  phone: true,
  status: true,
  notes: true,
  assigneeId: true,
  tenantId: true,
  submittedAt: true,
} satisfies Prisma.LeadSelect;
const subscriptionSummary = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  billableAccounts: true,
  plan: { select: { id: true, name: true } },
} satisfies Prisma.SubscriptionSelect;

function notFound() {
  return new NotFoundException('Không tìm thấy thông tin yêu cầu.');
}

@Injectable()
export class PlatformService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  private get db() {
    return this.database.client;
  }

  companies() {
    return this.database.runPlatform(null, async () => {
      const companies = await this.db.tenant.findMany({
        where: { deletedAt: null },
        select: { ...companyFields, initialAdminId: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      });
      return companies.map(({ initialAdminId, ...company }) => ({
        ...company,
        canInvite: initialAdminId !== null,
      }));
    });
  }

  async createCompany(body: unknown, actor: Actor) {
    const { company, leadId, admin } = input.newCompanyInput(body);
    const id = randomUUID();
    const adminId = randomUUID();
    const passwordHash = await hash(newSecret(), { type: argon2id });
    await this.database.runPlatform(id, async () => {
      // Let database defaults initialize private tenant settings.
      const inserted = await this.db.$executeRaw`
        INSERT INTO tenants (id, tenant_id, name, tax_code, address, contact_name,
          contact_phone, login_code, initial_admin_id, updated_at, created_by)
        VALUES (${id}::uuid, ${id}::uuid, ${company.name}, ${company.taxCode},
          ${company.address}, ${company.contactName}, ${company.contactPhone}, ${company.loginCode},
          ${adminId}::uuid, now(), ${actor.id}::uuid)
        ON CONFLICT (login_code) DO NOTHING
      `;
      if (!inserted)
        throw new ConflictException('Mã đăng nhập đã được sử dụng.');
      if (leadId) {
        const { count } = await this.db.lead.updateMany({
          where: { id: leadId, tenantId: null },
          data: { tenantId: id },
        });
        if (!count)
          throw new ConflictException(
            'Đăng ký đã được chuyển hoặc không còn tồn tại.',
          );
      }
      await this.db.$executeRaw`
        INSERT INTO users (id, tenant_id, full_name, email, password_hash, status, updated_at, created_by)
        VALUES (${adminId}::uuid, ${id}::uuid, ${admin.fullName}, ${admin.email}, ${passwordHash},
          'PENDING', now(), ${actor.id}::uuid)
      `;
      await this.db.userRole.createMany({
        data: {
          tenantId: id,
          userId: adminId,
          role: 'ADM',
          createdBy: actor.id,
        },
      });
      await this.audit(actor, id, 'CREATE_TENANT', 'Tenant', id, {
        ...company,
        leadId,
      });
      await this.audit(actor, id, 'ASSIGN_ROLE', 'User', adminId, {
        role: 'ADM',
      });
    });
    return {
      id,
      invitationSent: await this.auth.invitePendingAccount(adminId, id),
    };
  }

  async inviteAgain(id: string) {
    const company = await this.database.runPlatform(id, () =>
      this.db.tenant.findFirst({
        where: { id, deletedAt: null },
        select: { initialAdminId: true },
      }),
    );
    if (!company?.initialAdminId) throw notFound();
    if (!(await this.auth.invitePendingAccount(company.initialAdminId, id))) {
      throw new ConflictException(
        'Chưa gửi được lời mời. Kiểm tra trạng thái doanh nghiệp, tài khoản hoặc dịch vụ email.',
      );
    }
    return { invitationSent: true };
  }

  updateCompany(id: string, body: unknown, actor: Actor) {
    const company = input.companyInput(body);
    return this.companyWrite(id, async () => {
      await this.lockCompany(id);
      await this.db.tenant.update({
        where: { id },
        data: { ...company, updatedBy: actor.id },
        select: { id: true },
      });
      await this.audit(actor, id, 'UPDATE_TENANT', 'Tenant', id, company);
      return { id };
    });
  }

  setCompanyStatus(id: string, body: unknown, actor: Actor) {
    const status = input.companyStatus(body);
    return this.database.runPlatform(id, async () => {
      await this.lockCompany(id);
      const company = await this.db.tenant.update({
        where: { id },
        data: { status, updatedBy: actor.id },
        select: { id: true, status: true },
      });
      await this.audit(actor, id, 'UPDATE_TENANT_STATUS', 'Tenant', id, {
        status,
      });
      return company;
    });
  }

  plans() {
    return this.database.runPlatform(null, () =>
      this.db.plan.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
    );
  }

  savePlan(body: unknown, actor: Actor, id?: string) {
    const data = input.planInput(body);
    return this.database.runPlatform(null, async () => {
      if (
        id &&
        !(await this.db.plan.findUnique({
          where: { id },
          select: { id: true },
        }))
      )
        throw notFound();
      const plan = id
        ? await this.db.plan.update({ where: { id }, data })
        : await this.db.plan.create({ data });
      await this.audit(
        actor,
        null,
        id ? 'UPDATE_PLAN' : 'CREATE_PLAN',
        'Plan',
        plan.id,
        data,
      );
      return plan;
    });
  }

  billing(id: string) {
    return this.database.runPlatform(id, async () => {
      if (
        !(await this.db.tenant.findFirst({
          where: { id, deletedAt: null },
          select: { id: true },
        }))
      )
        throw notFound();
      return this.db.subscription.findMany({
        where: { tenantId: id, deletedAt: null },
        select: {
          ...subscriptionSummary,
          payments: {
            where: { deletedAt: null },
            orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
            select: { id: true, amount: true, paidAt: true, notes: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
    });
  }

  assignPlan(id: string, body: unknown, actor: Actor) {
    const data = input.subscriptionInput(body);
    return this.database.runPlatform(id, async () => {
      await this.lockCompany(id);
      if (
        !(await this.db.plan.findUnique({
          where: { id: data.planId },
          select: { id: true },
        }))
      )
        throw notFound();
      const current = await this.db.subscription.findFirst({
        where: { tenantId: id, deletedAt: null, status: 'ACTIVE' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { billableAccounts: true },
      });
      await this.db.subscription.updateMany({
        where: { tenantId: id, deletedAt: null, status: 'ACTIVE' },
        data: { status: 'CANCELLED', updatedBy: actor.id },
      });
      const subscription = await this.db.subscription.create({
        data: {
          ...data,
          tenantId: id,
          billableAccounts: current?.billableAccounts ?? 0,
          createdBy: actor.id,
        },
        select: { id: true },
      });
      await this.audit(
        actor,
        id,
        'ASSIGN_SUBSCRIPTION',
        'Subscription',
        subscription.id,
        {
          planId: data.planId,
          startsAt: data.startsAt.toISOString(),
          endsAt: data.endsAt.toISOString(),
        },
      );
      return subscription;
    });
  }

  renew(id: string, subscriptionId: string, body: unknown, actor: Actor) {
    const endsAt = input.renewalEnd(body);
    return this.database.runPlatform(id, async () => {
      await this.lockCompany(id);
      const existing = await this.findSubscription(id, subscriptionId);
      if (existing.status === 'CANCELLED' || endsAt <= existing.endsAt) {
        throw new ConflictException(
          'Ngày kết thúc mới phải sau ngày kết thúc của thuê bao hiện hành.',
        );
      }
      const other = await this.db.subscription.findFirst({
        where: {
          tenantId: id,
          deletedAt: null,
          status: 'ACTIVE',
          id: { not: subscriptionId },
        },
        select: { id: true },
      });
      if (other)
        throw new ConflictException(
          'Doanh nghiệp đã có thuê bao hiện hành khác.',
        );
      await this.db.subscription.update({
        where: { id: subscriptionId },
        data: { endsAt, status: 'ACTIVE', updatedBy: actor.id },
        select: { id: true },
      });
      await this.audit(
        actor,
        id,
        'RENEW_SUBSCRIPTION',
        'Subscription',
        subscriptionId,
        { endsAt: endsAt.toISOString() },
        { endsAt: existing.endsAt.toISOString() },
      );
      return { id: subscriptionId };
    });
  }

  recordPayment(
    id: string,
    subscriptionId: string,
    body: unknown,
    actor: Actor,
  ) {
    const data = input.paymentInput(body);
    return this.database.runPlatform(id, async () => {
      await this.lockCompany(id);
      await this.findSubscription(id, subscriptionId);
      const payment = await this.db.payment.create({
        data: {
          ...data,
          tenantId: id,
          subscriptionId,
          recordedBy: actor.id,
          createdBy: actor.id,
        },
        select: { id: true },
      });
      await this.audit(actor, id, 'RECORD_PAYMENT', 'Payment', payment.id, {
        subscriptionId,
        amount: data.amount,
        paidAt: data.paidAt.toISOString(),
      });
      return payment;
    });
  }

  leads(filters: {
    status?: LeadStatus;
    assigneeId?: string | null;
    search?: string;
  }) {
    return this.database.runPlatform(null, async () => {
      const { status, assigneeId, search } = filters;
      const leads = await this.db.lead.findMany({
        where: {
          status,
          assigneeId,
          OR: search
            ? [
                { companyName: { contains: search, mode: 'insensitive' } },
                { fullName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ]
            : undefined,
        },
        select: leadFields,
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      });
      return {
        leads,
        staff: await this.db.user.findMany({
          where: { tenantId: null, deletedAt: null, status: 'ACTIVE' },
          select: { id: true, fullName: true },
          orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        }),
      };
    });
  }

  lead(id: string) {
    return this.database.runPlatform(null, async () => {
      const lead = await this.db.lead.findUnique({
        where: { id },
        select: leadFields,
      });
      if (!lead) throw notFound();
      return lead;
    });
  }

  updateLead(id: string, body: unknown, actor: Actor) {
    const data = input.leadInput(body);
    return this.database.runPlatform(null, async () => {
      if (
        data.assigneeId &&
        !(await this.db.user.findFirst({
          where: {
            id: data.assigneeId,
            tenantId: null,
            deletedAt: null,
            status: 'ACTIVE',
          },
          select: { id: true },
        }))
      )
        throw notFound();
      const { count } = await this.db.lead.updateMany({ where: { id }, data });
      if (!count) throw notFound();
      await this.audit(actor, null, 'UPDATE_LEAD', 'Lead', id, {
        status: data.status,
        assigneeId: data.assigneeId,
      });
      return { id };
    });
  }

  private async lockCompany(id: string) {
    const [company] = await this.db.$queryRaw<{ id: string }[]>`
      SELECT id FROM tenants WHERE id = ${id}::uuid AND deleted_at IS NULL FOR UPDATE
    `;
    if (!company) throw notFound();
  }

  private async findSubscription(tenantId: string, id: string) {
    const subscription = await this.db.subscription.findFirst({
      where: { tenantId, id, deletedAt: null },
      select: { status: true, endsAt: true },
    });
    if (!subscription) throw notFound();
    return subscription;
  }

  private async companyWrite<T>(id: string, run: () => Promise<T>) {
    try {
      return await this.database.runPlatform(id, run);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Mã đăng nhập đã được sử dụng.');
      }
      throw error;
    }
  }

  private async audit(
    actor: Actor,
    tenantId: string | null,
    action: string,
    objectType: string,
    objectId: string,
    after: Prisma.InputJsonObject,
    before?: Prisma.InputJsonObject,
  ) {
    await this.db.auditLog.createMany({
      data: {
        tenantId,
        userId: actor.id,
        action,
        objectType,
        objectId,
        ip: actor.ip,
        before,
        after,
      },
    });
  }
}
