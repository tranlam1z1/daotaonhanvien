import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient, type Lead } from '@prisma/client';
import { Queue, Worker, type Job } from 'bullmq';
import Redis from 'ioredis';
import { createHash } from 'node:crypto';
import { createSmtpTransport, smtpFrom } from '../smtp';
import type { LeadInput } from './lead-input';

export const LEAD_QUEUE = 'lead-notifications';
export const LEAD_POLICY = {
  maxRequests: 5,
  windowSeconds: 60 * 60,
  dispatchIntervalMs: 5000,
  emailAttempts: 5,
  retryDelayMs: 1000,
};

export function leadEmail(lead: Lead) {
  const sizes: Record<string, string> = {
    'under-30': 'Dưới 30 nhân sự',
    '30-100': 'Từ 30 – 100 nhân sự',
    'over-100': 'Trên 100 nhân sự',
  };
  return {
    subject: 'EduCore36: Đăng ký pilot mới',
    text: [
      `Họ tên: ${lead.fullName}`,
      `Chức vụ: ${lead.jobTitle}`,
      `Doanh nghiệp: ${lead.companyName}`,
      `Quy mô: ${sizes[lead.companySize] ?? lead.companySize}`,
      `Số điện thoại: ${lead.phone}`,
      'Đã đồng ý xử lý dữ liệu cá nhân: Có',
      `Thời gian: ${lead.submittedAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
    ].join('\n'),
  };
}

@Injectable()
export class LeadInfrastructure
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(LeadInfrastructure.name);
  private readonly prisma = new PrismaClient();
  private readonly redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  private readonly redis = new Redis(this.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
  });
  private readonly queue = new Queue(LEAD_QUEUE, {
    connection: {
      url: this.redisUrl,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    },
  });
  private readonly mailer = createSmtpTransport();
  private worker?: Worker;
  private timer?: ReturnType<typeof setInterval>;
  private dispatching?: Promise<void>;

  async onApplicationBootstrap() {
    if (!process.env.LEAD_NOTIFY_EMAIL)
      throw new Error('LEAD_NOTIFY_EMAIL is required');
    // Log fixed messages only: dependency errors can contain credentials or personal data.
    this.redis.on('error', () =>
      this.logger.warn('Lead rate-limit Redis unavailable'),
    );
    this.queue.on('error', () =>
      this.logger.warn('Lead notification queue unavailable'),
    );
    this.worker = new Worker(
      LEAD_QUEUE,
      async (job: Job<{ leadId: string }>) => {
        const lead = await this.prisma.lead.findUniqueOrThrow({
          where: { id: job.data.leadId },
        });
        if (lead.notificationSentAt) return;
        await this.mailer.sendMail({
          from: smtpFrom(),
          to: process.env.LEAD_NOTIFY_EMAIL,
          ...leadEmail(lead),
        });
        await this.prisma.lead.update({
          where: { id: lead.id },
          data: { notificationSentAt: new Date() },
        });
      },
      {
        connection: { url: this.redisUrl, maxRetriesPerRequest: null },
        concurrency: 2,
      },
    );
    this.worker.on('error', () =>
      this.logger.warn('Lead notification worker unavailable'),
    );
    this.worker.on('failed', () =>
      this.logger.warn('Lead notification failed; inspect queue status'),
    );
    this.timer = setInterval(
      () => this.dispatch(),
      LEAD_POLICY.dispatchIntervalMs,
    );
    this.timer.unref();
    this.dispatch();
  }

  async consumeLimit(ip: string): Promise<number> {
    const key = `leads:rate:${createHash('sha256').update(ip).digest('hex')}`;
    // Atomic fixed window shared across all API processes; invalid/bot submissions count too.
    return Number(
      await this.redis.eval(
        `
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
      if count > tonumber(ARGV[2]) then return redis.call('TTL', KEYS[1]) end
      return 0
    `,
        1,
        key,
        LEAD_POLICY.windowSeconds,
        LEAD_POLICY.maxRequests,
      ),
    );
  }

  async save(input: LeadInput, ip: string) {
    const lead = await this.prisma.lead.create({ data: { ...input, ip } });
    try {
      await this.enqueue(lead.id);
    } catch {
      // The persisted pending lead is the outbox; the dispatcher retries after Redis recovers.
      this.logger.warn('Lead saved; notification pending queue recovery');
    }
  }

  private async enqueue(leadId: string) {
    await this.queue.add(
      'notify',
      { leadId },
      {
        jobId: leadId,
        attempts: LEAD_POLICY.emailAttempts,
        backoff: { type: 'exponential', delay: LEAD_POLICY.retryDelayMs },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  private dispatch() {
    if (this.dispatching) return;
    this.dispatching = (async () => {
      let cursor: string | undefined;
      for (;;) {
        const leads = await this.prisma.lead.findMany({
          where: { notificationSentAt: null },
          orderBy: { id: 'asc' },
          take: 100,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: { id: true },
        });
        for (const lead of leads) await this.enqueue(lead.id);
        if (leads.length < 100) break;
        cursor = leads[leads.length - 1].id;
      }
    })()
      .catch(() => this.logger.warn('Lead notification dispatch unavailable'))
      .finally(() => {
        this.dispatching = undefined;
      });
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.dispatching;
    await this.worker?.close();
    await this.queue.close();
    this.redis.disconnect();
    this.mailer.close();
    await this.prisma.$disconnect();
  }
}
