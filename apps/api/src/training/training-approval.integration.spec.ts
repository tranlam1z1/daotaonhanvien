import 'reflect-metadata';
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { webOrigin } from '../auth/auth-policy';
import { ObjectStorage } from '../files/object-storage';
import { TenantDatabase } from '../tenant/tenant-database';
import {
  createTenantFixture,
  removeTenantFixture,
} from '../testing/tenant-fixture';
import { TrainingApprovalService } from './training-approval.service';
import { TrainingModule } from './training.module';
import type { TrainingKind } from './training-workflow';

const integration =
  process.env.TENANT_INTEGRATION_TEST === 'true' ? describe : describe.skip;
const password = 'TestPassword36!';
const course = {
  name: 'Khóa học T16',
  description: 'Mô tả cũ',
  modules: [
    {
      name: 'Module T16',
      lessons: [
        {
          name: 'Bài một',
          type: 'TEXT',
          body: 'Nội dung cũ',
          durationMinutes: 1,
        },
        {
          name: 'Bài hai',
          type: 'TEXT',
          body: 'Nội dung hai',
          durationMinutes: 2,
        },
      ],
    },
  ],
};
const program = {
  name: 'Chương trình T16',
  description: 'Mô tả chương trình',
  audience: 'Nhân viên mới',
  type: 'ONBOARDING',
  targetUnit: 'HOURS',
  targetDuration: 1,
};

integration('T16 training approval', () => {
  const root = new PrismaClient();
  const signDownload = jest
    .fn()
    .mockResolvedValue({ url: 'https://storage.example/t16', expiresIn: 60 });
  let app: INestApplication;
  let db: TenantDatabase;
  let approval: TrainingApprovalService;
  let own: Awaited<ReturnType<typeof createTenantFixture>>;
  let other: typeof own;
  let author: string;
  let reviewer: string;
  let employee: string;
  let foreign: string;

  function api(
    method: 'get' | 'post' | 'patch',
    path: string,
    cookie = author,
  ) {
    return request(app.getHttpServer())
      [method]('/training' + path)
      .set('Origin', webOrigin())
      .set('Cookie', cookie);
  }

  async function login(identifier: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', webOrigin())
      .send({ identifier, password })
      .expect(204);
    return response.headers['set-cookie'][0].split(';')[0] as string;
  }

  async function draft(kind: TrainingKind, data?: object) {
    return (
      await api('post', '/editor/' + kind)
        .send({
          departmentId: own.department.id,
          ...(kind === 'courses' ? course : { ...program, courseIds: [] }),
          ...data,
        })
        .expect(201)
    ).body;
  }

  function authorAction(
    kind: TrainingKind,
    id: string,
    action: string,
    data: object,
    cookie = author,
  ) {
    return api(
      'post',
      '/editor/' + kind + '/' + id + '/workflow/' + action,
      cookie,
    ).send(data);
  }

  function decide(
    kind: TrainingKind,
    id: string,
    action: string,
    data: object,
    cookie = reviewer,
  ) {
    return api(
      'post',
      '/reviews/' + kind + '/' + id + '/' + action,
      cookie,
    ).send(data);
  }

  beforeAll(async () => {
    const passwordHash = await hash(password);
    own = await createTenantFixture(root, passwordHash);
    other = await createTenantFixture(root, passwordHash);
    await root.tenant.update({
      where: { id: own.tenantId },
      data: { config: { selfApproval: false } },
    });
    await root.userRole.create({
      data: {
        tenantId: own.tenantId,
        userId: own.users[1].id,
        role: 'PD',
        departmentIds: [own.department.id],
      },
    });
    const module = await Test.createTestingModule({ imports: [TrainingModule] })
      .overrideProvider(ObjectStorage)
      .useValue({ signDownload })
      .compile();
    app = module.createNestApplication();
    await app.init();
    db = app.get(TenantDatabase);
    approval = app.get(TrainingApprovalService);
    [author, reviewer, employee, foreign] = await Promise.all([
      login(own.users[0].email),
      login(own.users[1].email),
      login(own.users[2].email),
      login(other.users[0].email),
    ]);
  });

  afterAll(async () => {
    try {
      await app?.close();
      for (const fixture of [own, other]) {
        if (!fixture) continue;
        const where = { tenantId: fixture.tenantId };
        await root.$transaction(async (tx) => {
          await tx.trainingRejection.deleteMany({ where });
          await tx.trainingProgram.deleteMany({ where });
          await tx.trainingCourse.deleteMany({ where });
          await tx.fileObject.deleteMany({ where });
        });
        await removeTenantFixture(root, fixture.tenantId);
      }
    } finally {
      await root.$disconnect();
    }
  });

  it('approves programs and courses separately, never reading or allocating unapproved drafts', async () => {
    const staged = await draft('courses');
    const plan = await draft('programs', { courseIds: [staged.id] });
    const path = '/read/courses/' + staged.id;
    await api('get', path, employee).expect(404);
    await api('get', '/read/programs/' + plan.id, employee).expect(404);
    await api('get', '/assignable/courses/' + staged.id).expect(404);

    const queuedCourse = (
      await authorAction('courses', staged.id, 'submit', {
        revision: staged.revision,
      }).expect(200)
    ).body;
    const queuedPlan = (
      await authorAction('programs', plan.id, 'submit', {
        revision: plan.revision,
      }).expect(200)
    ).body;
    await api('patch', '/editor/courses/' + staged.id)
      .send({
        ...course,
        departmentId: own.department.id,
        revision: staged.revision,
      })
      .expect(409);
    await api('patch', '/editor/programs/' + plan.id)
      .send({
        ...program,
        departmentId: own.department.id,
        revision: plan.revision,
        courseIds: [],
      })
      .expect(409);
    await api('post', '/editor/courses')
      .send({ ...course, departmentId: own.department.id, programId: plan.id })
      .expect(409);

    const queue = (await api('get', '/reviews', reviewer).expect(200)).body;
    expect(queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'courses', id: staged.id }),
        expect.objectContaining({ kind: 'programs', id: plan.id }),
      ]),
    );
    const preview = (
      await api('get', '/reviews/courses/' + staged.id, reviewer).expect(200)
    ).body;
    expect(
      preview.content.modules[0].lessons.map(
        ({ body }: { body: string }) => body,
      ),
    ).toEqual(['Nội dung cũ', 'Nội dung hai']);

    await decide('programs', plan.id, 'approve', {
      token: queuedPlan.reviewToken,
    }).expect(200);
    await api('get', '/read/programs/' + plan.id, employee).expect(200);
    await api('get', path, employee).expect(404);
    await api('get', '/assignable/courses/' + staged.id).expect(404);
    await decide('courses', staged.id, 'approve', {
      token: queuedCourse.reviewToken,
    }).expect(200);
    const published = (await api('get', path, employee).expect(200)).body;
    expect(published).toMatchObject({
      name: course.name,
      revision: staged.revision,
    });
    await api('get', '/assignable/courses/' + staged.id).expect(200, {
      courseId: staged.id,
      versionId: published.versionId,
      revision: staged.revision,
    });

    const secondPlan = await draft('programs', { courseIds: [staged.id] });
    await authorAction('programs', secondPlan.id, 'submit', {
      revision: secondPlan.revision,
    }).expect(200);
    await api('get', '/read/programs/' + secondPlan.id, employee).expect(404);
  });

  it('freezes published lessons, order and settings, then resolves new and previously assigned versions', async () => {
    const staged = await draft('courses');
    await authorAction('courses', staged.id, 'publish', {
      revision: staged.revision,
    }).expect(403);
    await root.tenant.update({
      where: { id: own.tenantId },
      data: { config: { selfApproval: true } },
    });
    try {
      await authorAction('courses', staged.id, 'publish', {
        revision: staged.revision,
      }).expect(200);
    } finally {
      await root.tenant.update({
        where: { id: own.tenantId },
        data: { config: { selfApproval: false } },
      });
    }
    const assign = '/assignable/courses/' + staged.id;
    const first = (await api('get', assign).expect(200)).body;
    const assigned = (versionId: string) =>
      db.run(own.tenantId, () =>
        approval.assignedCourseVersion(own.tenantId, staged.id, versionId),
      );
    const original = await assigned(first.versionId);
    expect(original.content.modules[0].lessons.map(({ name }) => name)).toEqual(
      ['Bài một', 'Bài hai'],
    );

    const edited = (
      await api('patch', '/editor/courses/' + staged.id)
        .send({
          ...staged,
          name: 'Tên mới',
          learningMode: 'FREE',
          modules: [
            {
              ...staged.modules[0],
              lessons: [...staged.modules[0].lessons]
                .reverse()
                .map((entry) => ({ ...entry, body: 'Nội dung mới' })),
            },
          ],
        })
        .expect(200)
    ).body;
    expect(edited.status).toBe('DRAFT');
    await api('get', assign).expect(200, first);
    const readPath = '/read/courses/' + staged.id;
    expect((await api('get', readPath, employee).expect(200)).body.name).toBe(
      course.name,
    );
    await authorAction('courses', staged.id, 'submit', {
      revision: staged.revision,
    }).expect(409);
    const queued = (
      await authorAction('courses', staged.id, 'submit', {
        revision: edited.revision,
      }).expect(200)
    ).body;
    expect((await api('get', readPath, employee).expect(200)).body.name).toBe(
      course.name,
    );
    await decide(
      'courses',
      staged.id,
      'approve',
      { token: queued.reviewToken },
      author,
    ).expect(403);
    await decide('courses', staged.id, 'approve', {
      token: queued.reviewToken,
    }).expect(200);
    const latest = (await api('get', assign).expect(200)).body;
    expect(latest.versionId).not.toBe(first.versionId);
    expect((await api('get', readPath, employee).expect(200)).body.name).toBe(
      'Tên mới',
    );
    expect((await assigned(latest.versionId)).content).toMatchObject({
      name: 'Tên mới',
      learningMode: 'FREE',
    });
    expect(await assigned(first.versionId)).toEqual(original);
    await expect(
      db.run(other.tenantId, () =>
        approval.assignedCourseVersion(
          own.tenantId,
          staged.id,
          first.versionId,
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      db.run(own.tenantId, () =>
        approval.assignedCourseVersion(
          own.tenantId,
          randomUUID(),
          first.versionId,
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });

    const audits = await root.auditLog.findMany({
      where: {
        tenantId: own.tenantId,
        objectId: staged.id,
        action: 'training.approve',
      },
    });
    expect(audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: own.users[0].id,
          after: expect.objectContaining({ selfApproved: true }),
        }),
        expect.objectContaining({
          userId: own.users[1].id,
          after: expect.objectContaining({ selfApproved: false }),
        }),
      ]),
    );
  });

  it('adopts older drafts when an authorized editor submits them', async () => {
    const legacy = await root.trainingCourse.create({
      data: {
        tenantId: own.tenantId,
        departmentId: own.department.id,
        name: 'Nháp trước T16',
        description: 'Dữ liệu trước khi có người tạo',
      },
    });
    expect(legacy.authorId).toBeNull();
    const pending = (
      await authorAction('courses', legacy.id, 'submit', {
        revision: legacy.revision,
      }).expect(200)
    ).body;
    await decide('courses', legacy.id, 'reject', {
      token: pending.reviewToken,
      reason: 'Cập nhật nội dung',
    }).expect(200);
    expect((await api('get', '/rejections').expect(200)).body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: legacy.name,
          reason: 'Cập nhật nội dung',
        }),
      ]),
    );
  });

  it('requires a reason, notifies the author, validates review tokens and isolates every route', async () => {
    const fileId = randomUUID();
    await root.fileObject.create({
      data: {
        id: fileId,
        tenantId: own.tenantId,
        createdBy: own.users[0].id,
        contentType: 'application/pdf',
        storageKey: own.tenantId + '/' + fileId,
        name: 'Tài liệu T16',
        sizeBytes: 123n,
      },
    });
    const staged = await draft('courses', {
      modules: [
        {
          name: 'Tài liệu T16',
          lessons: [
            { name: 'Tài liệu', durationMinutes: 1, type: 'DOCUMENT', fileId },
          ],
        },
      ],
    });
    const outside = await draft('programs', { departmentId: null });
    await authorAction('programs', outside.id, 'submit', {
      revision: outside.revision,
    }).expect(200);
    await api('get', '/reviews/programs/' + outside.id, reviewer).expect(404);
    const submit = () =>
      authorAction('courses', staged.id, 'submit', {
        revision: staged.revision,
      }).expect(200);
    const first = (await submit()).body;
    const path = '/reviews/courses/' + staged.id;
    const filePath =
      path + '/lessons/' + staged.modules[0].lessons[0].id + '/file';
    await api('get', filePath, reviewer).expect(200);
    await api('get', filePath, foreign).expect(404);
    await api('get', path, foreign).expect(404);
    await api('get', '/reviews', foreign).expect(200, []);
    await api('get', path, employee).expect(403);
    await authorAction(
      'courses',
      staged.id,
      'withdraw',
      { token: first.reviewToken },
      foreign,
    ).expect(404);
    await decide(
      'courses',
      staged.id,
      'approve',
      { token: first.reviewToken },
      foreign,
    ).expect(404);
    await authorAction('courses', staged.id, 'withdraw', {
      token: first.reviewToken,
    }).expect(200);
    await api('get', filePath, reviewer).expect(404);
    const second = (await submit()).body;
    const token = second.reviewToken;
    await decide('courses', staged.id, 'reject', {
      token: first.reviewToken,
      reason: 'Cũ',
    }).expect(409);
    await decide('courses', staged.id, 'reject', { token, reason: ' ' }).expect(
      400,
    );
    const rejected = (
      await decide('courses', staged.id, 'reject', {
        token,
        reason: 'Bổ sung tài liệu',
      }).expect(200)
    ).body;
    expect(rejected).toMatchObject({
      status: 'DRAFT',
      rejectionReason: 'Bổ sung tài liệu',
    });

    const catalog = (await api('get', '/editor').expect(200)).body;
    expect(catalog.courses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: staged.id,
          rejectionReason: 'Bổ sung tài liệu',
          canSubmit: true,
        }),
      ]),
    );
    expect((await api('get', '/rejections').expect(200)).body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: course.name,
          reason: 'Bổ sung tài liệu',
        }),
      ]),
    );
    await api('get', '/rejections', reviewer).expect(200, []);
    await api('get', '/rejections', foreign).expect(200, []);
    const rejectionAudit = await root.auditLog.findFirst({
      where: {
        tenantId: own.tenantId,
        objectId: staged.id,
        action: 'training.reject',
      },
    });
    expect(rejectionAudit?.userId).toBe(own.users[1].id);
    const final = (await submit()).body;
    await decide('courses', staged.id, 'approve', {
      token: final.reviewToken,
    }).expect(200);
    await api('get', '/read/courses/' + staged.id, foreign).expect(404);
    await api('get', '/assignable/courses/' + staged.id, foreign).expect(404);
    await api('get', '/assignable/courses/' + staged.id, employee).expect(403);
  });
});
