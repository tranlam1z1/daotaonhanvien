import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { localDay } from '../assignments/assignment-input';
import { can } from '../auth/permissions';
import { bytesPerStorageGb } from '../files/file-policy';
import { readConfig } from '../organization/organization-input';
import { TenantDatabase } from '../tenant/tenant-database';
import { NoticeEmail } from './notice-email';

const checkIntervalMs = 60_000;
const defaultReminderDays = 3;
const renewalDays = [30, 7];
const quotaPercent = 90;

@Injectable()
export class NoticeCollector implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NoticeCollector.name);
  private timer?: NodeJS.Timeout;
  private task?: Promise<void>;

  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(NoticeEmail) private readonly email: NoticeEmail,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.task ??= this.run()
        .catch(() => this.logger.warn('Chưa thể cập nhật thông báo.'))
        .finally(() => {
          this.task = undefined;
        });
    }, checkIntervalMs);
    this.timer.unref();
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.task;
  }

  private async run() {
    const tenants = await this.database.runPlatform(null, () =>
      this.database.client.tenant.findMany({
        where: { deletedAt: null },
        select: { id: true },
      }),
    );
    for (const { id } of tenants) {
      await this.collectForTenant(id)
        .then(() => this.email.deliver(id))
        .catch(() =>
          this.logger.warn('Chưa thể cập nhật thông báo cho một doanh nghiệp.'),
        );
    }
  }

  collectForTenant(tenantId: string) {
    return this.database.run(tenantId, () => this.collect(tenantId));
  }

  private async collect(tenantId: string) {
    const db = this.database.client;
    const now = new Date();
    const today = localDay(now);
    const tenant = await db.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { config: true, storageUsedBytes: true },
    });
    const { reminderDays } = readConfig(tenant.config);
    const notices: Prisma.WorkspaceNoticeCreateManyInput[] = [];
    const add = (id: string | null, eventKey: string, message: string) => {
      if (id) notices.push({ tenantId, userId: id, eventKey, message });
    };
    const [
      enrollments,
      handovers,
      reviewers,
      knowledge,
      courses,
      programs,
      rejections,
      trainingRejections,
      subscription,
    ] = await Promise.all([
      db.enrollment.findMany({
        where: { tenantId, status: { not: 'CANCELLED' } },
        select: {
          id: true,
          userId: true,
          status: true,
          dueAt: true,
          course: { select: { name: true } },
          user: { select: { managerId: true } },
          progressPercent: true,
          courseVersion: { select: { content: true } },
          practice: { select: { passed: true } },
        },
      }),
      db.handoverCase.findMany({
        where: { tenantId, completedAt: null },
        select: {
          id: true,
          employeeId: true,
          dueOn: true,
          employee: { select: { fullName: true, managerId: true } },
        },
      }),
      db.user.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          deletedAt: null,
          roles: {
            some: { role: { in: ['ADM', 'PD', 'PTDT'] }, deletedAt: null },
          },
        },
        select: {
          id: true,
          status: true,
          roles: {
            where: { deletedAt: null },
            select: { role: true, departmentIds: true },
          },
        },
      }),
      db.knowledgeVersion.findMany({
        where: { tenantId, status: { in: ['IN_REVIEW', 'PUBLISHED'] } },
        select: {
          id: true,
          title: true,
          status: true,
          reviewToken: true,
          createdBy: true,
          departmentIds: true,
          audience: true,
        },
      }),
      db.trainingCourse.findMany({
        where: { tenantId, status: { in: ['IN_REVIEW', 'PUBLISHED'] } },
        select: {
          id: true,
          name: true,
          status: true,
          reviewToken: true,
          authorId: true,
          departmentId: true,
          revision: true,
        },
      }),
      db.trainingProgram.findMany({
        where: { tenantId, status: { in: ['IN_REVIEW', 'PUBLISHED'] } },
        select: {
          id: true,
          name: true,
          status: true,
          reviewToken: true,
          authorId: true,
          departmentId: true,
          revision: true,
        },
      }),
      db.knowledgeRejection.findMany({
        where: { tenantId },
        select: { id: true, userId: true, title: true, reason: true },
      }),
      db.trainingRejection.findMany({
        where: { tenantId },
        select: { id: true, userId: true, title: true, reason: true },
      }),
      db.subscription.findFirst({
        where: { tenantId, status: 'ACTIVE', deletedAt: null },
        orderBy: { startsAt: 'desc' },
        select: {
          id: true,
          endsAt: true,
          plan: { select: { maxAccounts: true, storageGb: true } },
        },
      }),
    ]);
    for (const row of enrollments) {
      const key = `training:${row.id}`;
      add(
        row.userId,
        `${key}:assigned`,
        `Bạn được giao khóa học ${row.course.name}.`,
      );
      if (row.status === 'FAILED')
        add(
          row.userId,
          `${key}:failed`,
          `Bạn chưa đạt khóa học ${row.course.name}.`,
        );
      if (!['NOT_STARTED', 'IN_PROGRESS', 'OVERDUE'].includes(row.status))
        continue;
      const deadline = row.dueAt.toISOString();
      if (row.dueAt < now)
        add(
          row.userId,
          `${key}:overdue:${deadline}`,
          `Khóa học ${row.course.name} đã quá hạn.`,
        );
      else if (
        localDay(row.dueAt) - today <=
        (reminderDays || defaultReminderDays)
      )
        add(
          row.userId,
          `${key}:reminder:${deadline}`,
          `Khóa học ${row.course.name} sắp đến hạn.`,
        );
      const content = row.courseVersion.content;
      const rules =
        content && typeof content === 'object' && !Array.isArray(content)
          ? content.completion
          : null;
      if (
        !row.practice?.passed &&
        rules &&
        typeof rules === 'object' &&
        !Array.isArray(rules) &&
        rules.practiceRequired === true &&
        typeof rules.lessonPercent === 'number' &&
        row.progressPercent >= rules.lessonPercent
      )
        add(
          row.user.managerId,
          `${key}:practice`,
          `Khóa học ${row.course.name} có lượt học chờ xác nhận thực hành.`,
        );
    }
    for (const row of handovers) {
      if (localDay(row.dueOn) >= today) continue;
      for (const recipient of [row.employeeId, row.employee.managerId])
        add(
          recipient,
          `handover:${row.id}:overdue`,
          `Hồ sơ bàn giao của ${row.employee.fullName} đã quá hạn.`,
        );
    }
    function approvers(departmentIds: (string | null)[]) {
      return reviewers.filter((reviewer) =>
        can(
          { ...reviewer, tenantId, hasDirectReports: false },
          'content.approve',
          { tenantId, departmentIds },
        ),
      );
    }
    for (const row of knowledge) {
      if (row.status === 'PUBLISHED')
        add(
          row.createdBy,
          `content:knowledge:${row.id}:published`,
          `Tri thức ${row.title} đã được xuất bản.`,
        );
      else
        for (const { id } of approvers(
          row.audience === 'DEPARTMENTS' ? row.departmentIds : [null],
        ))
          add(
            id,
            `content:knowledge:${row.id}:${row.reviewToken}`,
            `Tri thức ${row.title} đang chờ duyệt.`,
          );
    }
    for (const [type, records] of [
      ['course', courses],
      ['program', programs],
    ] as const) {
      for (const row of records) {
        if (row.status === 'PUBLISHED')
          add(
            row.authorId,
            `content:${type}:${row.id}:${row.revision}:published`,
            `Nội dung ${row.name} đã được xuất bản.`,
          );
        else
          for (const { id } of approvers([row.departmentId]))
            add(
              id,
              `content:${type}:${row.id}:${row.reviewToken}`,
              `Nội dung ${row.name} đang chờ duyệt.`,
            );
      }
    }
    for (const [type, records] of [
      ['knowledge', rejections],
      ['training', trainingRejections],
    ] as const)
      for (const row of records)
        add(
          row.userId,
          `content:${type}:${row.id}:rejected`,
          `Nội dung ${row.title} bị từ chối. Lý do: ${row.reason}`,
        );
    if (subscription) {
      const remaining = localDay(subscription.endsAt) - today;
      const accounts = await db.user.count({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: ['ACTIVE', 'HANDOVER'] },
        },
      });
      for (const { id, roles } of reviewers) {
        if (!roles.some(({ role }) => role === 'ADM')) continue;
        for (const days of renewalDays)
          if (remaining === days)
            add(
              id,
              `subscription:${subscription.id}:${days}`,
              `Gói thuê bao còn ${days} ngày.`,
            );
        if (accounts * 100 >= subscription.plan.maxAccounts * quotaPercent)
          add(
            id,
            `subscription:${subscription.id}:accounts`,
            `Doanh nghiệp đã sử dụng ít nhất ${quotaPercent}% số tài khoản trong gói.`,
          );
        if (
          tenant.storageUsedBytes * 100n >=
          BigInt(subscription.plan.storageGb) *
            bytesPerStorageGb *
            BigInt(quotaPercent)
        )
          add(
            id,
            `subscription:${subscription.id}:storage`,
            `Doanh nghiệp đã sử dụng ít nhất ${quotaPercent}% dung lượng trong gói.`,
          );
      }
    }
    for (let offset = 0; offset < notices.length; offset += 500)
      await db.workspaceNotice.createMany({
        data: notices.slice(offset, offset + 500),
        skipDuplicates: true,
      });
  }
}
