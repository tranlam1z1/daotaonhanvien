import 'reflect-metadata';
import 'dotenv/config';
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import {
  Controller,
  Get,
  Inject,
  Param,
  Req,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';
import { Workbook } from 'exceljs';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import request from 'supertest';
import { AppModule } from '../app.module';
import { type SessionRequest } from '../auth/auth-http';
import { webOrigin } from '../auth/auth-policy';
import { AuthModule } from '../auth/auth.module';
import { RequirePermission } from '../auth/authorization.guard';
import { LeadInfrastructure } from '../leads/leads.infrastructure';
import { TenantDatabase } from '../tenant/tenant-database';
import {
  createTenantFixture,
  removeTenantFixture,
} from '../testing/tenant-fixture';
import { bytesPerStorageGb } from './file-policy';
import { FilesModule } from './files.module';
import { FilesService } from './files.service';
import { createStorageClient, ObjectStorage } from './object-storage';

const integration =
  process.env.FILE_STORAGE_INTEGRATION_TEST === 'true'
    ? describe
    : describe.skip;
const password = 'TestPassword36!';
const pdf = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n',
);

type ContentLink = { tenantId: string; readerId: string; fileId: string };
const contentLinks = new Map<string, ContentLink>();

// Simulates a content handler that authorizes reading and resolves an attachment
// from its persisted link. This route is registered only in the test module.
@Controller('test-content')
class TestContentController {
  constructor(@Inject(FilesService) private readonly files: FilesService) {}

  @Get(':id/attachment')
  @RequirePermission('session.profile')
  download(@Req() request: SessionRequest, @Param('id') id: string) {
    return this.files.downloadForContent(request.user!, async (_db, reader) => {
      const link = contentLinks.get(id);
      return link?.tenantId === reader.tenantId && link.readerId === reader.id
        ? link.fileId
        : null;
    });
  }
}

integration('T10 private file storage with PostgreSQL and S3', () => {
  const root = new PrismaClient();
  const fixtures = [
    'S3_BUCKET',
    'FILE_DOCUMENT_MAX_MB',
    'FILE_VIDEO_MAX_MB',
    'FILE_DOWNLOAD_TTL_SECONDS',
  ] as const;
  const previous = new Map(fixtures.map((key) => [key, process.env[key]]));
  const bucket = 'educore36-t10-' + randomUUID();
  let s3: ReturnType<typeof createStorageClient>;
  let bucketCreated = false;
  let app: INestApplication;
  let own: Awaited<ReturnType<typeof createTenantFixture>>;
  let other: typeof own;
  let planId: string | undefined;
  let admin: string;
  let otherAdmin: string;
  let employee: string;
  let trainer: string;

  function upload(bytes: Buffer, filename: string, cookie = admin, query = '') {
    return request(app.getHttpServer())
      .post('/files' + query)
      .set('Origin', webOrigin())
      .set('Cookie', cookie)
      .attach('file', bytes, filename);
  }

  async function login(identifier: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', webOrigin())
      .send({ identifier, password })
      .expect(204);
    return response.headers['set-cookie'][0].split(';')[0] as string;
  }

  function download(contentId: string, cookie: string) {
    return request(app.getHttpServer())
      .get('/test-content/' + contentId + '/attachment')
      .set('Cookie', cookie);
  }

  async function listedKeys() {
    const response = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket }),
    );
    return (response.Contents ?? []).flatMap(({ Key }) => (Key ? [Key] : []));
  }

  async function usage() {
    const tenant = await root.tenant.findUniqueOrThrow({
      where: { id: own.tenantId },
    });
    return tenant.storageUsedBytes;
  }

  beforeAll(async () => {
    process.env.S3_BUCKET = bucket;
    process.env.FILE_DOCUMENT_MAX_MB = '1';
    process.env.FILE_VIDEO_MAX_MB = '2';
    process.env.FILE_DOWNLOAD_TTL_SECONDS = '2';
    s3 = createStorageClient();
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    bucketCreated = true;

    const passwordHash = await hash(password);
    own = await createTenantFixture(root, passwordHash);
    other = await createTenantFixture(root, passwordHash);
    const plan = await root.plan.create({
      data: {
        name: 'Gói T10',
        maxAccounts: 10,
        storageGb: 1,
        price: 0,
        cycle: 'MONTHLY',
      },
    });
    planId = plan.id;
    await root.subscription.createMany({
      data: [own, other].map(({ tenantId }) => ({
        tenantId,
        planId: plan.id,
        startsAt: new Date(),
        endsAt: new Date('2099-01-01'),
      })),
    });
    await root.userRole.create({
      data: {
        tenantId: own.tenantId,
        userId: own.users[2].id,
        role: 'PTDT',
        departmentIds: [own.department.id],
      },
    });

    const module = await Test.createTestingModule({
      imports: [AppModule, AuthModule, FilesModule],
      controllers: [TestContentController],
    })
      .overrideProvider(LeadInfrastructure)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    await app.init();
    admin = await login(own.users[0].email);
    otherAdmin = await login(other.users[0].email);
    employee = await login(own.users[1].email);
    trainer = await login(own.users[2].email);
  }, 20_000);

  afterAll(async () => {
    try {
      if (bucketCreated) {
        for (const key of await listedKeys()) {
          await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        }
        await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
      }
    } finally {
      try {
        for (const fixture of [own, other]) {
          if (!fixture) continue;
          await root.fileObject.deleteMany({
            where: { tenantId: fixture.tenantId },
          });
          await removeTenantFixture(root, fixture.tenantId);
        }
        if (planId) await root.plan.delete({ where: { id: planId } });
      } finally {
        for (const [key, value] of previous) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
        s3?.destroy();
        await app?.close();
        await root.$disconnect();
      }
    }
  }, 20_000);

  it('uploads documents, images and video and downloads through a permitted content link', async () => {
    const workbook = new Workbook();
    workbook.addWorksheet('Tài liệu').addRow(['T10']);
    const xlsx = Buffer.from(await workbook.xlsx.writeBuffer());
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3f0AAAAASUVORK5CYII=',
      'base64',
    );
    const videoHeader = Buffer.from(
      '00000018667479706d703432000000006d70343269736f6d',
      'hex',
    );
    const video = Buffer.alloc(2 * 1024 ** 2);
    videoHeader.copy(video);
    const before = await usage();
    const fixtures = [
      { data: pdf, filename: 'Tài liệu.pdf', type: 'application/pdf' },
      {
        data: xlsx,
        filename: 'mau.xlsx',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      { data: png, filename: 'anh.png', type: 'image/png' },
      { data: video, filename: 'video.mp4', type: 'video/mp4' },
    ];
    for (const { data, filename, type } of fixtures) {
      const response = await upload(data, filename).expect(201);
      expect(response.body).toEqual({
        id: expect.any(String),
        name: filename,
        contentType: type,
        sizeBytes: String(data.length),
      });
      const contentId = randomUUID();
      contentLinks.set(contentId, {
        tenantId: own.tenantId,
        readerId: own.users[1].id,
        fileId: response.body.id,
      });
      const signed = await download(contentId, employee).expect(200);
      expect(signed.body.expiresIn).toBe(2);
      const url = new URL(signed.body.url);
      expect(url.pathname).toBe(
        '/' + bucket + '/' + own.tenantId + '/' + response.body.id,
      );
      const result = await fetch(url);
      expect(result.status).toBe(200);
      expect(result.headers.get('content-type')).toBe(type);
      expect(result.headers.get('content-disposition')).toContain(
        "attachment; filename*=UTF-8''" + encodeURIComponent(filename),
      );
      expect(Buffer.from(await result.arrayBuffer())).toEqual(data);
    }
    expect(await usage()).toBe(
      before +
        BigInt(fixtures.reduce((total, entry) => total + entry.data.length, 0)),
    );
  }, 15_000);

  it('enforces session authorization, content links and tenant RLS even when given a foreign file ID', async () => {
    const foreign = await upload(pdf, 'foreign.pdf', otherAdmin).expect(201);
    await upload(pdf, 'anonymous.pdf', '').expect(401);
    await upload(pdf, 'nv.pdf', employee).expect(403);
    await upload(pdf, 'trainer.pdf', trainer).expect(403);
    await upload(
      pdf,
      'trainer.pdf',
      trainer,
      '?departmentId=' + other.department.id,
    ).expect(403);
    await upload(
      pdf,
      'trainer.pdf',
      trainer,
      '?departmentId=' + own.department.id,
    ).expect(201);
    const ownFile = await upload(
      pdf,
      'own.pdf',
      admin,
      '?tenantId=' + other.tenantId,
    ).expect(201);
    expect(
      await root.fileObject.findUnique({ where: { id: ownFile.body.id } }),
    ).toMatchObject({ tenantId: own.tenantId });
    await request(app.getHttpServer())
      .get('/files/' + foreign.body.id)
      .set('Cookie', admin)
      .expect(404);

    const foreignLink = randomUUID();
    contentLinks.set(foreignLink, {
      tenantId: other.tenantId,
      readerId: other.users[0].id,
      fileId: foreign.body.id,
    });
    await download(foreignLink, admin).expect(404);
    const ownLink = randomUUID();
    contentLinks.set(ownLink, {
      tenantId: own.tenantId,
      readerId: own.users[1].id,
      fileId: ownFile.body.id,
    });
    await download(ownLink, admin).expect(404);
    await download(ownLink, otherAdmin).expect(404);

    const wrongLink = randomUUID();
    contentLinks.set(wrongLink, {
      tenantId: own.tenantId,
      readerId: own.users[1].id,
      fileId: foreign.body.id,
    });
    await download(wrongLink, employee).expect(404);
    const database = app.get(TenantDatabase);
    await database.run(own.tenantId, async () => {
      expect(
        await database.client.fileObject.findUnique({
          where: { id: foreign.body.id },
        }),
      ).toBeNull();
    });
    await expect(
      database.run(own.tenantId, async () => {
        const id = randomUUID();
        return database.client.fileObject.create({
          data: {
            id,
            tenantId: other.tenantId,
            storageKey: other.tenantId + '/' + id,
            contentType: 'application/pdf',
            name: 'foreign.pdf',
            sizeBytes: 1n,
            createdBy: own.users[0].id,
          },
        });
      }),
    ).rejects.toThrow(/row-level security/i);
  });

  it('rejects unsupported or mislabelled files and enforces both size limits without charging quota', async () => {
    const before = await usage();
    const keys = await listedKeys();
    await upload(Buffer.from('<html>demo</html>'), 'site.html').expect(415);
    await upload(Buffer.from('<html>demo</html>'), 'site.pdf').expect(415);
    await upload(Buffer.from('504b0304', 'hex'), 'zip.docx').expect(415);
    const oversizedPdf = Buffer.alloc(1024 ** 2 + 1);
    pdf.copy(oversizedPdf);
    await upload(oversizedPdf, 'document.pdf').expect(413);
    const oversizedVideo = Buffer.alloc(2 * 1024 ** 2 + 1);
    await upload(oversizedVideo, 'video.mp4').expect(413);
    expect(await usage()).toBe(before);
    expect(await listedKeys()).toEqual(keys);
  });

  it('allows the signed URL only until it expires and keeps the bucket private', async () => {
    const uploaded = await upload(pdf, 'expiring.pdf').expect(201);
    const id = randomUUID();
    contentLinks.set(id, {
      tenantId: own.tenantId,
      readerId: own.users[1].id,
      fileId: uploaded.body.id,
    });
    const signed = await download(id, employee).expect(200);
    const url = new URL(signed.body.url);
    const unsigned = new URL(url.pathname, url.origin);
    const anonymous = await fetch(unsigned);
    expect(anonymous.status).toBe(403);
    await anonymous.arrayBuffer();
    const allowed = await fetch(url);
    expect(allowed.ok).toBe(true);
    await allowed.arrayBuffer();
    await delay((signed.body.expiresIn + 1) * 1000);
    const expired = await fetch(url);
    expect(expired.status).toBe(403);
    expect(await expired.text()).toMatch(/expired/i);
  }, 10_000);

  it('cleans up when the storage write fails after receiving bytes', async () => {
    const before = await usage();
    const keys = await listedKeys();
    const storage = app.get(ObjectStorage);
    const realUpload = storage.upload.bind(storage);
    const fail = jest
      .spyOn(storage, 'upload')
      .mockImplementationOnce(async (...args) => {
        await realUpload(...args);
        throw new Error('simulated acknowledgement failure');
      });
    try {
      await upload(pdf, 'failed.pdf').expect(503);
      expect(await usage()).toBe(before);
      expect(await listedKeys()).toEqual(keys);
      expect(
        await root.fileObject.count({
          where: { tenantId: own.tenantId, name: 'failed.pdf' },
        }),
      ).toBe(0);
    } finally {
      fail.mockRestore();
    }
  });

  it('admits just one upload into the remaining quota and cleans up the other object', async () => {
    const originalUsage = await usage();
    const originalKeys = await listedKeys();
    const remaining = BigInt(pdf.length);
    await root.tenant.update({
      where: { id: own.tenantId },
      data: { storageUsedBytes: bytesPerStorageGb - remaining },
    });

    const storage = app.get(ObjectStorage);
    const realUpload = storage.upload.bind(storage);
    let uploads = 0;
    let release!: () => void;
    const bothStored = new Promise<void>((resolve) => {
      release = resolve;
    });
    const barrier = jest
      .spyOn(storage, 'upload')
      .mockImplementation(async (...args) => {
        await realUpload(...args);
        if (++uploads === 2) release();
        await bothStored;
      });
    try {
      const results = await Promise.all([
        upload(pdf, 'race-a.pdf').timeout(5000),
        upload(pdf, 'race-b.pdf').timeout(5000),
      ]);
      expect(results.map(({ status }) => status).sort()).toEqual([201, 409]);
      expect(await usage()).toBe(bytesPerStorageGb);
      await upload(pdf, 'over-quota.pdf').expect(409);
      const remainingObjects = (await listedKeys()).filter(
        (key) => !originalKeys.includes(key),
      );
      expect(remainingObjects).toEqual([
        own.tenantId +
          '/' +
          results.find(({ status }) => status === 201)?.body.id,
      ]);
      expect(uploads).toBe(2);
    } finally {
      release();
      barrier.mockRestore();
      const sum = await root.fileObject.aggregate({
        where: { tenantId: own.tenantId },
        _sum: { sizeBytes: true },
      });
      await root.tenant.update({
        where: { id: own.tenantId },
        data: { storageUsedBytes: sum._sum.sizeBytes ?? originalUsage },
      });
    }
  }, 10_000);
});
