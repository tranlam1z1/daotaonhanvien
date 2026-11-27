import 'reflect-metadata';
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { LeadInfrastructure, LEAD_POLICY } from './leads.infrastructure';

const integration =
  process.env.LEAD_INTEGRATION_TEST === 'true' ? describe : describe.skip;

integration('T02 integration: PostgreSQL + Redis + BullMQ + Mailpit', () => {
  let app: INestApplication;
  let infrastructure: LeadInfrastructure;
  const prisma = new PrismaClient();
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    lazyConnect: true,
  });
  const marker = `T02-${randomUUID()}`;
  const ip = randomUUID();
  const rateKey = `leads:rate:${createHash('sha256').update(ip).digest('hex')}`;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    infrastructure = app.get(LeadInfrastructure);
  });
  afterAll(async () => {
    await app?.close();
    await prisma.lead.deleteMany({ where: { companyName: marker } });
    await prisma.$disconnect();
    if (redis.status === 'ready') await redis.del(rateKey);
    redis.disconnect();
  });

  it('AC-16/17: persists real input and delivers plain-text email within one minute', async () => {
    const payload = '<img src=x onerror="alert(1)"><script>alert(1)</script>';
    const startedAt = Date.now();
    await request(app.getHttpServer())
      .post('/public/leads')
      .send({
        fullName: payload,
        jobTitle: 'Giám đốc',
        companyName: marker,
        companySize: '30-100',
        phone: '0912 345 678',
        consent: true,
        website: '',
        tenant_id: randomUUID(),
        status: 'PILOT',
      })
      .expect(201);
    const lead = await prisma.lead.findFirstOrThrow({
      where: { companyName: marker },
    });
    expect(lead).toMatchObject({
      fullName: payload,
      phone: '0912345678',
      consent: true,
      status: 'NEW',
      tenantId: null,
      assigneeId: null,
    });
    const mailpit = process.env.MAILPIT_URL ?? 'http://localhost:8025';
    while (Date.now() - startedAt < 60000) {
      const search = await fetch(
        `${mailpit}/api/v1/search?query=${encodeURIComponent(marker)}`,
      );
      if (!search.ok) throw new Error('Mailpit search failed');
      const results = (await search.json()) as { messages: { ID: string }[] };
      for (const message of results.messages) {
        const response = await fetch(`${mailpit}/api/v1/message/${message.ID}`);
        const email = (await response.json()) as {
          Text: string;
          HTML: string;
          To: { Address: string }[];
        };
        if (!email.Text.includes(marker)) continue;
        expect(email.Text).toContain(payload);
        expect(email.HTML).toBeFalsy();
        expect(email.To.map((recipient) => recipient.Address)).toContain(
          process.env.LEAD_NOTIFY_EMAIL,
        );
        expect(Date.now() - startedAt).toBeLessThan(60000);
        // Only delete the message produced by this isolated test.
        await fetch(`${mailpit}/api/v1/messages`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ IDs: [message.ID] }),
        });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('Lead notification did not arrive within one minute');
  }, 65000);

  it('atomically allows five requests/IP/hour across processes and resets after expiry', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => infrastructure.consumeLimit(ip)),
    );
    expect(results.filter((result) => result === 0)).toHaveLength(5);
    expect(results.filter((result) => result > 0)).toHaveLength(5);
    const ttl = await redis.ttl(rateKey);
    expect(ttl).toBeGreaterThan(LEAD_POLICY.windowSeconds - 10);
    expect(ttl).toBeLessThanOrEqual(LEAD_POLICY.windowSeconds);
    // Expire this test's key, without waiting an hour or clearing shared Redis data.
    await redis.pexpire(rateKey, 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await infrastructure.consumeLimit(ip)).toBe(0);
  });
});
