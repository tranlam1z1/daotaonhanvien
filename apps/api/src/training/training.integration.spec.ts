import 'reflect-metadata';
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { webOrigin } from '../auth/auth-policy';
import { ObjectStorage } from '../files/object-storage';
import { LeadInfrastructure } from '../leads/leads.infrastructure';
import {
  createTenantFixture,
  removeTenantFixture,
} from '../testing/tenant-fixture';

const integration =
  process.env.TENANT_INTEGRATION_TEST === 'true' ? describe : describe.skip;
const password = 'TestPassword36!';
const payload = '<img src=x onerror="window.t14Executed=true">';

const program = {
  name: 'Hội nhập nhân viên',
  description: payload,
  audience: 'Nhân viên mới',
  type: 'ONBOARDING',
  targetUnit: 'DAYS',
  targetDuration: 3,
  courseIds: [] as string[],
};
const course = {
  name: 'Khóa học T14',
  description: '',
  modules: [] as object[],
};
const lesson = { name: 'Bài T14', durationMinutes: 15 };

integration('T14 training builder', () => {
  const root = new PrismaClient();
  const signDownload = jest
    .fn()
    .mockResolvedValue({ url: 'https://storage.example/t14', expiresIn: 60 });
  let app: INestApplication;
  let own: Awaited<ReturnType<typeof createTenantFixture>>;
  let other: typeof own;
  let secondaryDepartment: string;
  let admin: string;
  let otherAdmin: string;
  let trainer: string;
  let employee: string;

  function api(
    method: 'get' | 'post' | 'patch',
    route: string,
    cookie = admin,
  ) {
    return request(app.getHttpServer())
      [method]('/training/editor' + route)
      .set('Origin', webOrigin())
      .set('Cookie', cookie);
  }

  async function login(identifier: string) {
    const result = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', webOrigin())
      .send({ identifier, password })
      .expect(204);
    return result.headers['set-cookie'][0].split(';')[0] as string;
  }

  function file(
    tenantId: string,
    createdBy: string,
    contentType = 'application/pdf',
  ) {
    const id = randomUUID();
    return root.fileObject.create({
      data: {
        id,
        tenantId,
        createdBy,
        contentType,
        storageKey: tenantId + '/' + id,
        name: 'Tệp thử',
        sizeBytes: 123n,
      },
    });
  }

  function knowledge(
    fixture: typeof own,
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
    departmentId?: string,
  ) {
    return root.knowledgeItem.create({
      data: {
        tenantId: fixture.tenantId,
        createdBy: fixture.users[0].id,
        versions: {
          create: {
            createdBy: fixture.users[0].id,
            status,
            title: 'Tri thức T14',
            summary: '',
            bodyHtml: '',
            audience: departmentId ? 'DEPARTMENTS' : 'TENANT',
            departmentIds: departmentId ? [departmentId] : [],
          },
        },
      },
    });
  }

  function withLesson(data: object, departmentId?: string) {
    return {
      ...course,
      departmentId,
      modules: [{ name: 'Module T14', lessons: [{ ...lesson, ...data }] }],
    };
  }

  beforeAll(async () => {
    const passwordHash = await hash(password);
    own = await createTenantFixture(root, passwordHash);
    other = await createTenantFixture(root, passwordHash);
    secondaryDepartment = (
      await root.department.create({
        data: { tenantId: own.tenantId, name: 'Phòng khác' },
      })
    ).id;
    await root.userRole.create({
      data: {
        tenantId: own.tenantId,
        userId: own.users[2].id,
        role: 'PTDT',
        departmentIds: [own.department.id],
      },
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LeadInfrastructure)
      .useValue({})
      .overrideProvider(ObjectStorage)
      .useValue({ signDownload })
      .compile();
    app = module.createNestApplication();
    await app.init();
    [admin, otherAdmin, trainer, employee] = await Promise.all([
      login(own.users[0].email),
      login(other.users[0].email),
      login(own.users[2].email),
      login(own.users[1].email),
    ]);
  });

  afterAll(async () => {
    await app?.close();
    try {
      for (const fixture of [own, other].filter(Boolean)) {
        const { tenantId } = fixture;
        await root.$transaction(async (tx) => {
          await tx.programCourse.deleteMany({ where: { tenantId } });
          await tx.trainingCourse.deleteMany({ where: { tenantId } });
          await tx.trainingProgram.deleteMany({ where: { tenantId } });
          await tx.quiz.deleteMany({ where: { tenantId } });
          await tx.knowledgeVersion.deleteMany({ where: { tenantId } });
          await tx.knowledgeItem.deleteMany({ where: { tenantId } });
          await tx.fileObject.deleteMany({ where: { tenantId } });
        });
        await removeTenantFixture(root, tenantId);
      }
    } finally {
      await root.$disconnect();
    }
  });

  it('creates and edits complete programs sharing one course, with revision checks', async () => {
    const first = (await api('post', '/programs').send(program).expect(201))
      .body;
    const shared = (
      await api('post', '/courses')
        .send({ ...course, programId: first.id })
        .expect(201)
    ).body;
    const second = (
      await api('post', '/programs')
        .send({
          ...program,
          name: 'Chuyên môn',
          type: 'SPECIALIST',
          targetUnit: 'HOURS',
          targetDuration: 4,
          courseIds: [shared.id],
        })
        .expect(201)
    ).body;
    await api('patch', '/programs/' + first.id)
      .send({ ...program, revision: first.revision })
      .expect(409);
    const catalog = (await api('get', '').expect(200)).body;
    const firstRow = catalog.programs.find(
      (row: { id: string }) => row.id === first.id,
    );
    const secondRow = catalog.programs.find(
      (row: { id: string }) => row.id === second.id,
    );
    expect(firstRow).toMatchObject({
      name: program.name,
      description: payload,
      audience: program.audience,
      type: 'ONBOARDING',
      targetUnit: 'DAYS',
      targetDuration: 3,
      courses: [{ courseId: shared.id }],
    });
    expect(secondRow).toMatchObject({
      type: 'SPECIALIST',
      targetUnit: 'HOURS',
      courses: [{ courseId: shared.id }],
    });
    await api('patch', '/programs/' + first.id)
      .send({
        ...program,
        targetDuration: 5,
        revision: firstRow.revision,
        courseIds: [shared.id],
      })
      .expect(200);
    const updated = (await api('get', '').expect(200)).body.programs.find(
      (row: { id: string }) => row.id === first.id,
    );
    expect(updated.targetDuration).toBe(5);
    expect(updated.courses).toEqual([{ courseId: shared.id }]);
  });

  it('persists each lesson configuration and explicit order, then edits a separate draft copy', async () => {
    const document = await file(own.tenantId, own.users[0].id);
    const video = await file(own.tenantId, own.users[0].id, 'video/mp4');
    const article = await knowledge(own, 'PUBLISHED');
    const quiz = await root.quiz.create({
      data: { tenantId: own.tenantId, name: 'Kiểm tra T14' },
    });
    const lessons = [
      { ...lesson, name: 'Văn bản', type: 'TEXT', body: payload },
      { ...lesson, name: 'Tài liệu', type: 'DOCUMENT', fileId: document.id },
      { ...lesson, name: 'Video tải lên', type: 'VIDEO', fileId: video.id },
      {
        ...lesson,
        name: 'Video liên kết',
        type: 'VIDEO',
        videoUrl: 'https://video.example/bai-hoc',
      },
      {
        ...lesson,
        name: 'Tri thức',
        type: 'KNOWLEDGE',
        knowledgeId: article.id,
      },
      { ...lesson, name: 'Bài kiểm tra', type: 'QUIZ', quizId: quiz.id },
    ];
    const original = (
      await api('post', '/courses')
        .send({
          ...course,
          modules: [
            { name: 'Thứ nhất', lessons },
            { name: 'Thứ hai', lessons: [] },
          ],
        })
        .expect(201)
    ).body;
    expect(original.modules[0].lessons).toMatchObject(lessons);
    const [first, second] = original.modules;
    await api('patch', '/courses/' + original.id)
      .send({
        ...original,
        modules: [second, { ...first, lessons: [...first.lessons].reverse() }],
      })
      .expect(200);
    const saved = (await api('get', '/courses/' + original.id).expect(200))
      .body;
    expect(saved.modules.map((entry: { id: string }) => entry.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(saved.modules[1].lessons).toMatchObject([...lessons].reverse());
    const savedDocument = saved.modules[1].lessons.find(
      (entry: { type: string }) => entry.type === 'DOCUMENT',
    );
    await api(
      'get',
      '/courses/' + original.id + '/lessons/' + savedDocument.id + '/file',
    ).expect(200);
    expect(signDownload).toHaveBeenCalledWith(
      expect.objectContaining({ storageKey: document.storageKey }),
    );
    await api(
      'get',
      '/courses/' + original.id + '/lessons/' + first.lessons[0].id + '/file',
    ).expect(404);

    const copy = (
      await api('post', '/courses/' + original.id + '/copy')
        .send({ name: 'Bản sao độc lập' })
        .expect(201)
    ).body;
    expect(copy.status).toBe('DRAFT');
    expect(copy.id).not.toBe(original.id);
    expect(copy.modules[1].id).not.toBe(first.id);
    expect(copy.modules[1].lessons[0].id).not.toBe(
      saved.modules[1].lessons[0].id,
    );
    expect(copy.modules[1].lessons).toMatchObject([...lessons].reverse());
    await api('patch', '/courses/' + copy.id)
      .send({
        ...copy,
        modules: [{ ...copy.modules[0], name: 'Đổi tên' }],
      })
      .expect(200);
    await api('get', '/courses/' + original.id).expect(200, saved);
  });

  it('rejects unauthorized, foreign, draft and archived references', async () => {
    const foreignFile = await file(other.tenantId, other.users[0].id);
    const hiddenFile = await file(own.tenantId, own.users[1].id);
    const foreignKnowledge = await knowledge(other, 'PUBLISHED');
    const restricted = await knowledge(own, 'PUBLISHED', secondaryDepartment);
    const draft = await knowledge(own, 'DRAFT');
    const archived = await knowledge(own, 'PUBLISHED');
    await root.knowledgeVersion.create({
      data: {
        tenantId: own.tenantId,
        itemId: archived.id,
        revision: 2,
        status: 'ARCHIVED',
        createdBy: own.users[0].id,
        title: 'Phiên bản đã lưu trữ',
        summary: '',
        bodyHtml: '',
        audience: 'TENANT',
      },
    });
    const foreignQuiz = await root.quiz.create({
      data: { tenantId: other.tenantId, name: 'Bài kiểm tra doanh nghiệp B' },
    });
    const restrictedQuiz = await root.quiz.create({
      data: {
        tenantId: own.tenantId,
        departmentId: secondaryDepartment,
        name: 'Bài kiểm tra phòng khác',
      },
    });
    const invalid = [
      { type: 'DOCUMENT', fileId: foreignFile.id },
      { type: 'DOCUMENT', fileId: hiddenFile.id },
      ...[foreignKnowledge, restricted, draft, archived].map(({ id }) => ({
        type: 'KNOWLEDGE',
        knowledgeId: id,
      })),
      ...[foreignQuiz, restrictedQuiz].map(({ id }) => ({
        type: 'QUIZ',
        quizId: id,
      })),
      { type: 'VIDEO', videoUrl: 'javascript:alert(1)' },
    ];
    for (const configuration of invalid)
      await api('post', '/courses').send(withLesson(configuration)).expect(400);
    const catalog = (await api('get', '').expect(200)).body;
    for (const article of [foreignKnowledge, restricted, draft, archived])
      expect(catalog.knowledge).not.toContainEqual(
        expect.objectContaining({ id: article.id }),
      );
  });

  it('isolates catalog, course, program, copy, download and write paths across tenants and grants', async () => {
    const document = await file(other.tenantId, other.users[0].id);
    const target = (
      await api('post', '/programs', otherAdmin).send(program).expect(201)
    ).body;
    const foreign = (
      await api('post', '/courses', otherAdmin)
        .send({
          ...withLesson({ type: 'DOCUMENT', fileId: document.id }),
          programId: target.id,
        })
        .expect(201)
    ).body;
    const scoped = (
      await api('post', '/courses', trainer)
        .send({ ...course, departmentId: own.department.id })
        .expect(201)
    ).body;
    expect((await api('get', '').expect(200)).body.courses).not.toContainEqual(
      expect.objectContaining({ id: foreign.id }),
    );
    expect((await api('get', '').expect(200)).body.programs).not.toContainEqual(
      expect.objectContaining({ id: target.id }),
    );
    expect((await api('get', '', trainer).expect(200)).body.courses).toEqual([
      expect.objectContaining({ id: scoped.id }),
    ]);
    await api('get', '', employee).expect(403);
    await api('get', '/courses/' + foreign.id).expect(404);
    await api('patch', '/courses/' + foreign.id)
      .send(foreign)
      .expect(404);
    await api('post', '/courses/' + foreign.id + '/copy')
      .send({ name: 'Bản sao' })
      .expect(404);
    await api(
      'get',
      '/courses/' +
        foreign.id +
        '/lessons/' +
        foreign.modules[0].lessons[0].id +
        '/file',
    ).expect(404);
    await api('post', '/programs')
      .send({ ...program, courseIds: [foreign.id], tenantId: other.tenantId })
      .expect(400);
    await api('patch', '/programs/' + target.id)
      .send({ ...program, revision: target.revision })
      .expect(404);
    await api('post', '/courses')
      .send({ ...course, programId: target.id })
      .expect(400);
    await api('post', '/courses', trainer).send(course).expect(403);
    await api('post', '/programs', trainer)
      .send({ ...program, departmentId: secondaryDepartment })
      .expect(403);
    const outsideScope = (
      await api('post', '/courses')
        .send({ ...course, departmentId: secondaryDepartment })
        .expect(201)
    ).body;
    await api('get', '/courses/' + outsideScope.id, trainer).expect(404);
    await api('post', '/courses/' + outsideScope.id + '/copy', trainer)
      .send({ name: 'Bản sao' })
      .expect(404);
  });
});
