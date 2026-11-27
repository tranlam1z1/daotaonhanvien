import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { createSmtpTransport, smtpFrom } from '../smtp';
import { TenantDatabase } from '../tenant/tenant-database';

const quotaWarningPercent = 90;
const bytesPerGb = 1024n ** 3n;

export async function employeeQuota(
  db: Prisma.TransactionClient,
  tenantId: string,
) {
  const scope = { tenantId, deletedAt: null };
  const [subscription, accounts, tenant] = await Promise.all([
    db.subscription.findFirst({
      where: { ...scope, status: { in: ['ACTIVE', 'EXPIRED'] } },
      orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        plan: { select: { maxAccounts: true, storageGb: true } },
      },
    }),
    db.user.count({
      where: { ...scope, status: { in: ['ACTIVE', 'HANDOVER'] } },
    }),
    db.tenant.findUniqueOrThrow({
      where: { tenantId },
      select: { storageUsedBytes: true, name: true },
    }),
  ]);
  const maxAccounts = subscription?.plan.maxAccounts ?? null;
  const storageGb = subscription?.plan.storageGb ?? null;
  return {
    subscriptionId: subscription?.id,
    companyName: tenant.name,
    accounts,
    maxAccounts,
    accountWarning:
      maxAccounts !== null &&
      accounts * 100 >= maxAccounts * quotaWarningPercent,
    storageWarning:
      storageGb !== null &&
      tenant.storageUsedBytes * 100n >=
        BigInt(storageGb) * bytesPerGb * BigInt(quotaWarningPercent),
  };
}

@Injectable()
export class EmployeeQuotaMailer implements OnModuleDestroy {
  private readonly transport = createSmtpTransport();
  private readonly logger = new Logger(EmployeeQuotaMailer.name);

  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  async blocked(
    companyName: string,
    admins: string[],
    accounts: number,
    maximum: number,
  ) {
    try {
      const operators = await this.database.runPlatform(
        null,
        () =>
          this.database.client.$queryRaw<{ email: string }[]>`
          SELECT email FROM public.employee_quota_platform_recipients()
        `,
      );
      const recipients = new Set([
        ...admins,
        ...operators.map(({ email }) => email),
      ]);
      await Promise.all(
        [...recipients].map((to) =>
          this.transport.sendMail({
            from: smtpFrom(),
            to,
            subject: 'EduCore36 – Đã đạt giới hạn tài khoản',
            text: `Doanh nghiệp ${companyName} đang dùng ${accounts}/${maximum} tài khoản. Yêu cầu kích hoạt thêm đã bị chặn.`,
          }),
        ),
      );
    } catch {
      this.logger.warn('Employee quota email could not be sent');
    }
  }

  onModuleDestroy() {
    this.transport.close();
  }
}
