import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import { webOrigin } from '../auth/auth-policy';
import { createSmtpTransport, smtpFrom } from '../smtp';
import { TenantDatabase } from '../tenant/tenant-database';

export const optionalEmailGroups = [
  'training',
  'content',
  'subscription',
] as const;

const leaseDurationMs = 5 * 60_000;

@Injectable()
export class NoticeEmail implements OnModuleDestroy {
  private readonly logger = new Logger(NoticeEmail.name);
  private readonly transport = createSmtpTransport();

  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  onModuleDestroy() {
    this.transport.close();
  }

  async deliver(tenantId: string) {
    const now = new Date();
    const eligible = {
      tenantId,
      emailHandledAt: null,
      OR: [
        { emailClaimedAt: null },
        { emailClaimedAt: { lt: new Date(+now - leaseDurationMs) } },
      ],
    };
    const users = await this.database.run(tenantId, () =>
      this.database.client.workspaceNotice.findMany({
        where: eligible,
        orderBy: { createdAt: 'asc' },
        distinct: ['userId'],
        take: 20,
        select: { userId: true },
      }),
    );
    for (const { userId } of users) {
      const result = await this.database.run(tenantId, async () => {
        const db = this.database.client;
        // Concurrent workers cannot each claim part of the same recipient's batch.
        await db.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
        const pending = await db.workspaceNotice.findMany({
          where: { ...eligible, userId },
          select: { id: true, eventKey: true },
        });
        if (!pending.length) return null;
        await db.workspaceNotice.updateMany({
          where: { ...eligible, userId },
          data: { emailClaimedAt: now },
        });
        const recipient = await db.user.findFirst({
          where: { id: userId, tenantId, deletedAt: null },
          select: { email: true, mutedEmailGroups: true },
        });
        return { pending, recipient };
      });
      if (!result) continue;
      const { pending, recipient } = result;
      const send =
        recipient &&
        pending.some(({ eventKey }) => {
          const [group] = eventKey.split(':');
          return (
            group === 'handover' ||
            eventKey.includes(':overdue:') ||
            !recipient.mutedEmailGroups.includes(group)
          );
        });
      try {
        if (send) {
          const signIn = new URL('/dang-nhap', webOrigin());
          // Send only the approved generic copy. Event details stay in-app.
          await this.transport.sendMail({
            from: smtpFrom(),
            to: recipient.email,
            subject: 'Thông báo EduCore36',
            text: `Bạn có thông báo mới trên EduCore36\n${signIn.href}`,
          });
        }
        await this.database.run(tenantId, () =>
          this.database.client.workspaceNotice.updateMany({
            where: {
              tenantId,
              userId,
              id: { in: pending.map(({ id }) => id) },
              emailClaimedAt: now,
            },
            data: { emailHandledAt: new Date() },
          }),
        );
      } catch {
        this.logger.warn('Email thông báo chưa gửi được và sẽ được thử lại.');
      }
    }
  }
}
