import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { LeadInfrastructure, leadEmail } from './leads.infrastructure';
import type { Lead } from '@prisma/client';

export const validLead = {
  fullName: ' Nguyễn Văn An ',
  jobTitle: 'Giám đốc',
  companyName: 'Công ty Thanh Hóa',
  companySize: '30-100',
  phone: '+84 912 345 678',
  consent: true,
  website: '',
};

describe('POST /public/leads (AC-16, AC-17)', () => {
  let app: INestApplication;
  const infrastructure = { consumeLimit: jest.fn(), save: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LeadInfrastructure)
      .useValue(infrastructure)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    infrastructure.consumeLimit.mockResolvedValue(0);
    infrastructure.save.mockResolvedValue(undefined);
  });
  afterAll(async () => {
    await app.close();
  });

  it('accepts a normalized registration without exposing saved data', async () => {
    const response = await request(app.getHttpServer())
      .post('/public/leads')
      .send(validLead)
      .expect(201);
    expect(response.body).toEqual({ message: 'Đăng ký đã được tiếp nhận.' });
    expect(infrastructure.save).toHaveBeenCalledWith(
      {
        fullName: 'Nguyễn Văn An',
        jobTitle: validLead.jobTitle,
        companyName: validLead.companyName,
        companySize: validLead.companySize,
        phone: '0912345678',
        consent: true,
      },
      expect.any(String),
    );
  });

  it.each([
    { fullName: '' },
    { fullName: 123 },
    { fullName: 'x'.repeat(201) },
    { jobTitle: ' ' },
    { companyName: '' },
    { companySize: 'invalid' },
    { phone: '123' },
    { phone: '+1 2025550199' },
    { phone: '0112345678' },
    { consent: false },
    { consent: 'true' },
    { consent: null },
    { website: {} },
  ])('rejects invalid fields: %j', async (fields) => {
    await request(app.getHttpServer())
      .post('/public/leads')
      .send({ ...validLead, ...fields })
      .expect(400);
    expect(infrastructure.save).not.toHaveBeenCalled();
  });

  it.each([
    'fullName',
    'jobTitle',
    'companyName',
    'companySize',
    'phone',
    'consent',
  ])('rejects missing %s', async (field) => {
    const body: Record<string, unknown> = { ...validLead };
    delete body[field];
    await request(app.getHttpServer())
      .post('/public/leads')
      .send(body)
      .expect(400);
    expect(infrastructure.save).not.toHaveBeenCalled();
  });

  it('silently drops a filled honeypot even when required fields are missing', async () => {
    await request(app.getHttpServer())
      .post('/public/leads')
      .send({ website: 'spam.example' })
      .expect(201);
    expect(infrastructure.consumeLimit).toHaveBeenCalled();
    expect(infrastructure.save).not.toHaveBeenCalled();
  });

  it('returns 429 and Retry-After before writing', async () => {
    infrastructure.consumeLimit.mockResolvedValue(3599);
    const response = await request(app.getHttpServer())
      .post('/public/leads')
      .send(validLead)
      .expect(429);
    expect(response.headers['retry-after']).toBe('3599');
    expect(infrastructure.save).not.toHaveBeenCalled();
  });

  it('ignores forged IP, status, assignee and tenant data', async () => {
    await request(app.getHttpServer())
      .post('/public/leads')
      .set('X-Forwarded-For', '203.0.113.8')
      .send({
        ...validLead,
        tenant_id: 'tenant-b',
        tenantId: 'tenant-b',
        status: 'PILOT',
        ip: 'forged',
        assigneeId: 'other',
      })
      .expect(201);
    expect(infrastructure.consumeLimit).not.toHaveBeenCalledWith('203.0.113.8');
    const saved = infrastructure.save.mock.calls[0];
    expect(saved[0]).not.toHaveProperty('tenantId');
    expect(saved[0]).not.toHaveProperty('status');
    expect(saved[0]).not.toHaveProperty('assigneeId');
    expect(saved[1]).not.toBe('forged');
  });

  it('has no public read or update endpoint for any tenant', async () => {
    await request(app.getHttpServer()).get('/public/leads').expect(404);
    await request(app.getHttpServer())
      .patch('/public/leads/other-lead')
      .send({ status: 'PILOT' })
      .expect(404);
  });

  it('returns friendly 503 on storage/rate-limit failure without leaking internals', async () => {
    infrastructure.save.mockRejectedValue(
      new Error('private connection string'),
    );
    const response = await request(app.getHttpServer())
      .post('/public/leads')
      .send(validLead)
      .expect(503);
    expect(JSON.stringify(response.body)).not.toContain('private');
    infrastructure.consumeLimit.mockRejectedValue(
      new Error('private redis credentials'),
    );
    await request(app.getHttpServer())
      .post('/public/leads')
      .send(validLead)
      .expect(503);
  });

  it('AC-17: preserves HTML as data and uses a fixed email subject and plain text', async () => {
    const payload =
      '<img src=x onerror="window.__xss=1"><script>alert(1)</script>';
    await request(app.getHttpServer())
      .post('/public/leads')
      .send({
        ...validLead,
        fullName: payload,
        jobTitle: payload,
        companyName: payload,
      })
      .expect(201);
    const saved = infrastructure.save.mock.calls[0][0];
    expect(saved.fullName).toBe(payload);
    const email = leadEmail({
      ...saved,
      submittedAt: new Date('2026-11-27T03:00:00Z'),
    } as Lead);
    expect(email.text).toContain(payload);
    expect(email).not.toHaveProperty('html');
    expect(email.subject).not.toContain(payload);
  });
});
