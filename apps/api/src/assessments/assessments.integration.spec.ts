import 'reflect-metadata';
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';
import { Workbook } from 'exceljs';
import request from 'supertest';
import { AppModule } from '../app.module';
import { webOrigin } from '../auth/auth-policy';
import { LeadInfrastructure } from '../leads/leads.infrastructure';
import { TenantDatabase } from '../tenant/tenant-database';
import {
  createTenantFixture,
  removeTenantFixture,
} from '../testing/tenant-fixture';
import { questionTemplate } from './question-workbook';

const integration =
  process.env.TENANT_INTEGRATION_TEST === 'true' ? describe : describe.skip;
const password = 'TestPassword36!';
const base = '/assessments';
const question = {
  topic: 'An toàn lao động',
  prompt: 'Thiết bị nào cần được kiểm tra?',
  type: 'SINGLE_CHOICE',
  options: ['Bình chữa cháy', 'Bảng nội quy'],
  correctOptions: [1],
  explanation: 'Kiểm tra bình chữa cháy trước khi sử dụng.',
};
const quiz = {
  name: 'Kiểm tra an toàn',
  selectionMode: 'FIXED',
  timeLimitMinutes: 10,
  passingScore: 80,
  maxAttempts: 2,
  shuffleQuestions: false,
  shuffleOptions: true,
  showAnswers: true,
};

integration('T21 assessment authoring', () => {
  const root = new PrismaClient();
  let app: INestApplication;
  let own: Awaited<ReturnType<typeof createTenantFixture>>;
  let foreign: typeof own;
  let admin: string;
  let foreignAdmin: string;
  let employee: string;
  let trainer: string;

  function api(
    method: 'get' | 'post' | 'patch' | 'delete',
    path = '',
    cookie = admin,
  ) {
    return request(app.getHttpServer())
      [method](base + path)
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

  beforeAll(async () => {
    const passwordHash = await hash(password);
    own = await createTenantFixture(root, passwordHash);
    foreign = await createTenantFixture(root, passwordHash);
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
      .compile();
    app = module.createNestApplication();
    await app.init();
    [admin, foreignAdmin, employee, trainer] = await Promise.all([
      login(own.users[0].email),
      login(foreign.users[0].email),
      login(own.users[1].email),
      login(own.users[2].email),
    ]);
  });

  afterAll(async () => {
    try {
      for (const fixture of [own, foreign]) {
        if (!fixture) continue;
        const where = { tenantId: fixture.tenantId };
        await root.quiz.deleteMany({ where });
        await root.assessmentQuestion.deleteMany({ where });
        await root.trainingCourse.deleteMany({ where });
        await removeTenantFixture(root, fixture.tenantId);
      }
    } finally {
      await app?.close();
      await root.$disconnect();
    }
  });

  it('manages course and topic questions with all three types and validates answer counts', async () => {
    const course = await root.trainingCourse.create({
      data: { tenantId: own.tenantId, name: 'An toàn', description: '' },
    });
    const first = (await api('post', '/questions').send(question).expect(201))
      .body;
    const second = (
      await api('post', '/questions')
        .send({
          ...question,
          courseId: course.id,
          topic: '',
          type: 'MULTIPLE_CHOICE',
          correctOptions: [2, 1],
        })
        .expect(201)
    ).body;
    expect(second).toMatchObject({
      courseId: course.id,
      topic: null,
      correctOptions: [1, 2],
    });
    const edited = (
      await api('patch', '/questions/' + first.id)
        .send({
          ...question,
          type: 'TRUE_FALSE',
          correctOptions: [2],
        })
        .expect(200)
    ).body;
    expect(edited).toMatchObject({
      type: 'TRUE_FALSE',
      options: ['Đúng', 'Sai'],
      correctOptions: [2],
      explanation: question.explanation,
    });
    await api('post', '/questions')
      .send({ ...question, correctOptions: [1, 2] })
      .expect(400);
    await api('post', '/questions')
      .send({ ...question, courseId: course.id })
      .expect(400);
    await api('delete', '/questions/' + second.id).expect(204);
  });

  it('keeps fixed order and stores all settings for a random pool', async () => {
    const first = (await api('post', '/questions').send(question).expect(201))
      .body;
    const second = (
      await api('post', '/questions')
        .send({ ...question, prompt: 'Câu tiếp theo' })
        .expect(201)
    ).body;
    const fixed = (
      await api('post', '/quizzes')
        .send({
          ...quiz,
          questionIds: [second.id, first.id],
        })
        .expect(201)
    ).body;
    expect(fixed).toMatchObject({
      ...quiz,
      randomCount: null,
      questions: [{ questionId: second.id }, { questionId: first.id }],
    });
    const randomized = (
      await api('patch', '/quizzes/' + fixed.id)
        .send({
          ...quiz,
          selectionMode: 'RANDOM',
          randomCount: 1,
          questionIds: [first.id, second.id],
          shuffleQuestions: true,
        })
        .expect(200)
    ).body;
    expect(randomized).toMatchObject({
      selectionMode: 'RANDOM',
      randomCount: 1,
      shuffleQuestions: true,
    });
    await api('patch', '/quizzes/' + fixed.id)
      .send({
        ...quiz,
        selectionMode: 'RANDOM',
        randomCount: 3,
        questionIds: [first.id, second.id],
      })
      .expect(400);
    await api('delete', '/questions/' + first.id).expect(409);

    const training = await request(app.getHttpServer())
      .get('/training/editor')
      .set('Cookie', admin)
      .expect(200);
    expect(training.body.quizzes).toContainEqual(
      expect.objectContaining({ id: fixed.id }),
    );
  });

  it('downloads a template and rejects a mixed-validity Excel batch before writing any row', async () => {
    await api('get', '/questions/template')
      .expect(200)
      .expect(
        'Content-Disposition',
        'attachment; filename="mau-nhap-cau-hoi.xlsx"',
      );
    const workbook = new Workbook();
    await workbook.xlsx.load(Uint8Array.from(await questionTemplate()).buffer);
    const sheet = workbook.worksheets[0];
    sheet.addRow([
      'Nhiều đáp án',
      'Câu hỏi trong tệp',
      'Một\nHai',
      '1,2',
      'Giải thích',
    ]);
    const invalid = sheet.addRow(['Đúng/Sai', 'Câu thứ hai', '', '3']);
    const importPath =
      '/questions/import?topic=' + encodeURIComponent('Nhập Excel');
    const failed = await api('post', importPath)
      .attach(
        'file',
        Buffer.from(await workbook.xlsx.writeBuffer()),
        'questions.xlsx',
      )
      .expect(400);
    expect(failed.body.errors).toMatchObject([{ row: 3 }]);
    expect(
      await root.assessmentQuestion.count({
        where: { tenantId: own.tenantId, topic: 'Nhập Excel' },
      }),
    ).toBe(0);
    invalid.getCell(4).value = '2';
    const ok = await api('post', importPath)
      .attach(
        'file',
        Buffer.from(await workbook.xlsx.writeBuffer()),
        'questions.xlsx',
      )
      .expect(201);
    expect(ok.body).toEqual({ count: 2 });
  });

  it('blocks employee access, cross-tenant lookups and references, and unrelated department access', async () => {
    const ownQuestion = (
      await api('post', '/questions', trainer)
        .send({
          ...question,
          departmentId: own.department.id,
        })
        .expect(201)
    ).body;
    const ownQuiz = (
      await api('post', '/quizzes', trainer)
        .send({
          ...quiz,
          departmentId: own.department.id,
          questionIds: [ownQuestion.id],
        })
        .expect(201)
    ).body;
    const foreignQuestion = (
      await api('post', '/questions', foreignAdmin).send(question).expect(201)
    ).body;
    const visibleToForeign = (await api('get', '', foreignAdmin).expect(200))
      .body;
    expect(visibleToForeign.questions).not.toContainEqual(
      expect.objectContaining({ id: ownQuestion.id }),
    );
    expect(visibleToForeign.quizzes).not.toContainEqual(
      expect.objectContaining({ id: ownQuiz.id }),
    );
    await api('get', '', employee).expect(403);
    await api('get', '/questions/template', employee).expect(403);
    await api('post', '/questions/import?topic=external', employee).expect(403);
    await api('post', '/questions', trainer).send(question).expect(403);
    await api('patch', '/questions/' + ownQuestion.id, foreignAdmin)
      .send(question)
      .expect(404);
    await api('delete', '/questions/' + ownQuestion.id, foreignAdmin).expect(
      404,
    );
    await api('post', '/quizzes')
      .send({ ...quiz, questionIds: [foreignQuestion.id] })
      .expect(400);
    await api('patch', '/quizzes/' + ownQuiz.id, foreignAdmin)
      .send({
        ...quiz,
        questionIds: [foreignQuestion.id],
      })
      .expect(404);
    await api('post', '/questions', foreignAdmin)
      .send({
        ...question,
        departmentId: own.department.id,
      })
      .expect(400);

    const db = app.get(TenantDatabase);
    const deniedByRls = await db.run(foreign.tenantId, () =>
      db.client.quizQuestion.findMany({ where: { quizId: ownQuiz.id } }),
    );
    expect(deniedByRls).toEqual([]);
    const foreignWrite = await db.run(foreign.tenantId, () =>
      db.client.assessmentQuestion.updateMany({
        where: { id: ownQuestion.id },
        data: { prompt: 'Ghi khác doanh nghiệp' },
      }),
    );
    expect(foreignWrite.count).toBe(0);
    const trainerCatalog = (await api('get', '', trainer).expect(200)).body;
    expect(trainerCatalog.tenantWide).toBe(false);
    expect(trainerCatalog.questions).toHaveLength(1);
    expect(trainerCatalog.questions[0].id).toBe(ownQuestion.id);
  });
});
