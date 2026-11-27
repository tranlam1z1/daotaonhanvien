import 'reflect-metadata';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';
import request from 'supertest';
import { AppModule } from '../app.module';
import { webOrigin } from '../auth/auth-policy';
import { LeadInfrastructure } from '../leads/leads.infrastructure';
import { TenantDatabase } from '../tenant/tenant-database';
import { AttemptService } from './attempt.service';
import {
  createTenantFixture,
  removeTenantFixture,
} from '../testing/tenant-fixture';

const integration =
  process.env.TENANT_INTEGRATION_TEST === 'true' ? describe : describe.skip;
const password = 'TestPassword36!';

integration('T18 enrollment constraints and T23 learning', () => {
  const root = new PrismaClient();
  const first = randomUUID();
  const second = randomUUID();
  const third = randomUUID();
  let app: INestApplication;
  let own: Awaited<ReturnType<typeof createTenantFixture>>;
  let other: typeof own;
  let courseId: string;
  let versionId: string;
  let otherEnrollmentId: string;
  let learner: string;
  let teammate: string;
  let admin: string;
  let foreignAdmin: string;

  function snapshot(title: string, thirdText = 'Nội dung cũ') {
    return {
      name: title,
      description: '',
      learningMode: 'SEQUENTIAL',
      modules: [
        {
          id: first,
          name: 'Bắt đầu',
          lessons: [
            {
              id: first,
              name: 'Văn bản',
              type: 'TEXT',
              body: 'Nội dung',
              durationMinutes: 5,
            },
            {
              id: second,
              name: 'Video',
              type: 'VIDEO',
              videoUrl: 'https://example.org/video.mp4',
              durationMinutes: 2,
            },
            {
              id: third,
              name: 'Bài cuối',
              type: 'TEXT',
              body: thirdText,
              durationMinutes: 5,
            },
          ].map((lesson) => ({
            body: null,
            videoUrl: null,
            file: null,
            fileId: null,
            knowledgeId: null,
            quizId: null,
            ...lesson,
          })),
        },
      ],
    };
  }

  async function login(identifier: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', webOrigin())
      .send({ identifier, password })
      .expect(204);
    return response.headers['set-cookie'][0].split(';')[0] as string;
  }

  async function course(tenantId: string, title: string) {
    const course = await root.trainingCourse.create({
      data: { tenantId, name: title, description: '', status: 'PUBLISHED' },
    });
    const version = await root.trainingRelease.create({
      data: {
        tenantId,
        courseId: course.id,
        revision: 1,
        content: snapshot(title),
      },
    });
    return { course, version };
  }

  function api(method: 'get' | 'post', path = '', cookie = learner) {
    return request(app.getHttpServer())
      [method]('/learning' + path)
      .set('Origin', webOrigin())
      .set('Cookie', cookie);
  }

  function enrollmentInput(dueAt = new Date(Date.now() + 86_400_000)) {
    return {
      tenantId: own.tenantId,
      userId: own.users[1].id,
      courseId,
      courseVersionId: versionId,
      source: 'MANUAL' as const,
      dueAt,
    };
  }

  async function exam(practiceRequired: boolean) {
    const quizId = randomUUID();
    const lessonId = randomUUID();
    const course = await root.trainingCourse.create({
      data: {
        tenantId: own.tenantId,
        name: 'Khóa có kiểm tra',
        description: '',
        status: 'PUBLISHED',
      },
    });
    const version = await root.trainingRelease.create({
      data: {
        tenantId: own.tenantId,
        courseId: course.id,
        revision: 1,
        content: {
          ...snapshot('Khóa có kiểm tra'),
          completion: {
            lessonRequired: true,
            lessonPercent: 100,
            finalScoreRequired: true,
            finalScorePercent: 75,
            attemptLimitEnabled: true,
            maxAttempts: 1,
            practiceRequired,
          },
          modules: [
            {
              id: first,
              name: 'Module',
              lessons: [
                {
                  id: lessonId,
                  name: 'Kiểm tra',
                  type: 'QUIZ',
                  quizId,
                  durationMinutes: 1,
                },
              ],
            },
          ],
          quizDefinitions: {
            [quizId]: {
              selectionMode: 'RANDOM',
              randomCount: 1,
              timeLimitMinutes: 1,
              passingScore: 60,
              maxAttempts: 3,
              showAnswers: true,
              shuffleQuestions: true,
              shuffleOptions: true,
              questions: [
                {
                  type: 'MULTIPLE_CHOICE',
                  prompt: 'Chọn hai đáp án',
                  options: ['Đúng A', 'Sai', 'Đúng B'],
                  correctOptions: [1, 3],
                  explanation: 'Giải thích',
                },
              ],
            },
          },
        },
      },
    });
    const row = await root.enrollment.create({
      data: {
        ...enrollmentInput(new Date('2020-01-01T00:00:00Z')),
        courseId: course.id,
        courseVersionId: version.id,
      },
    });
    return {
      row,
      lessonId,
      path: '/' + row.id + '/lessons/' + lessonId + '/quiz/',
    };
  }

  beforeAll(async () => {
    const passwordHash = await hash(password);
    own = await createTenantFixture(root, passwordHash);
    other = await createTenantFixture(root, passwordHash);
    const local = await course(own.tenantId, 'Phiên bản đã giao');
    courseId = local.course.id;
    versionId = local.version.id;
    const foreign = await course(other.tenantId, 'Khóa doanh nghiệp B');
    otherEnrollmentId = (
      await root.enrollment.create({
        data: {
          tenantId: other.tenantId,
          userId: other.users[1].id,
          courseId: foreign.course.id,
          courseVersionId: foreign.version.id,
          source: 'MANUAL',
          dueAt: new Date(),
        },
      })
    ).id;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LeadInfrastructure)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    await app.init();
    learner = await login(own.users[1].email);
    teammate = await login(own.users[2].email);
    admin = await login(own.users[0].email);
    foreignAdmin = await login(other.users[0].email);
  });

  it('freezes the randomized paper, saves answers and completes late after practice; survey stays optional and isolated', async () => {
    const { row, path } = await exam(true);
    await root.user.update({
      where: { id: own.users[1].id },
      data: { managerId: own.users[2].id },
    });
    const surveyPath = '/' + row.id + '/survey';
    const report = {
      ratings: { content: 5, usefulness: 4, length: 3 },
      feedback: 'Có ích',
    };
    const template = {
      content: 'Nội dung mới',
      usefulness: 'Ứng dụng',
      length: 'Độ dài',
      feedback: 'Góp ý',
    };
    await api('post', '/survey/template', learner).send(template).expect(403);
    await api('post', '/survey/template', admin).send(template).expect(200);
    await api('get', '/survey/template', foreignAdmin)
      .expect(200)
      .expect(({ body }) => {
        expect(body.content).not.toBe(template.content);
      });
    await api('post', surveyPath).send(report).expect(409);
    for (const action of ['load', 'start', 'save', 'submit', 'review']) {
      await api('post', path + action, foreignAdmin)
        .send({})
        .expect(404);
      await api('post', path + action, teammate)
        .send({})
        .expect(404);
    }
    const { body: loaded } = await api('post', path + 'start')
      .send({})
      .expect(200);
    expect(loaded).toMatchObject({
      maxAttempts: 1,
      passingScore: 75,
      status: 'OVERDUE',
    });
    const { attempt } = loaded;
    expect(attempt.questions[0]).not.toHaveProperty('correctOptions');
    expect(attempt.questions[0]).not.toHaveProperty('explanation');
    const selected = attempt.questions[0].options.flatMap(
      (option: string, index: number) =>
        option.startsWith('Đúng') ? [index + 1] : [],
    );
    await api('post', path + 'save')
      .send({ attemptId: attempt.id, answers: { 0: selected } })
      .expect(200);
    const saved = (
      await api('post', path + 'load')
        .send({})
        .expect(200)
    ).body;
    expect(saved.attempt.answers).toEqual({ 0: selected });
    expect(saved.attempt.questions).toEqual(attempt.questions);
    await api('post', path + 'submit')
      .send({ attemptId: attempt.id })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: 'OVERDUE',
          attempt: { score: 100, passed: true },
        });
        expect(body.attempt.questions[0].correctOptions).toEqual(selected);
      });
    const practicePath = '/practice/' + row.id + '/confirm';
    await api('post', practicePath, learner)
      .send({ passed: true, comment: 'Đạt' })
      .expect(403);
    await api('post', practicePath, foreignAdmin)
      .send({ passed: true, comment: 'Đạt' })
      .expect(404);
    await api('get', '/practice/list', foreignAdmin).expect(200, []);
    await api('post', practicePath, teammate)
      .send({ passed: false, comment: 'Cần luyện thêm' })
      .expect(200)
      .expect({ status: 'OVERDUE' });
    await api('post', practicePath, teammate)
      .send({ passed: true, comment: 'Đạt' })
      .expect(200)
      .expect({ status: 'COMPLETED' });
    await api('get')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toContainEqual(
          expect.objectContaining({
            id: row.id,
            score: 100,
            status: 'COMPLETED',
            completedLate: true,
          }),
        );
      });
    await api('get', surveyPath, teammate).expect(404);
    await api('post', surveyPath, foreignAdmin).send(report).expect(404);
    await api('get', surveyPath)
      .expect(200)
      .expect({ template, submitted: false });
    await api('post', surveyPath).send(report).expect(200);
    await api('post', surveyPath)
      .send({ ...report, feedback: 'Gửi lại' })
      .expect(200);
    const response = await root.courseSurveyResponse.findUniqueOrThrow({
      where: {
        tenantId_enrollmentId: { tenantId: own.tenantId, enrollmentId: row.id },
      },
    });
    expect(response.feedback).toBe(report.feedback);
    expect(
      (await root.enrollment.findUniqueOrThrow({ where: { id: row.id } }))
        .status,
    ).toBe('COMPLETED');
  });

  it('auto-submits saved answers once while disconnected and fails an exhausted enrollment', async () => {
    const { row, path } = await exam(false);
    const { attempt } = (
      await api('post', path + 'start')
        .send({})
        .expect(200)
    ).body;
    const wrongOption = attempt.questions[0].options.indexOf('Sai') + 1;
    await api('post', path + 'save')
      .send({ attemptId: attempt.id, answers: { 0: [wrongOption] } })
      .expect(200);
    const now = Date.now();
    const expiresAt = new Date(now - 1000);
    await root.quizAttempt.update({
      where: { id: attempt.id },
      data: { startedAt: new Date(now - 61_000), expiresAt },
    });
    const service = app.get(AttemptService);
    await Promise.all([service.expireDue(), service.expireDue()]);
    const result = await root.quizAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });
    expect(result).toMatchObject({
      submittedAt: expiresAt,
      score: 0,
      passed: false,
      answers: { 0: [wrongOption] },
    });
    await api('post', path + 'submit')
      .send({ attemptId: attempt.id })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: 'FAILED',
          canStart: false,
          attempt: { score: 0, passed: false },
        });
      });
    expect(
      await root.quizAttempt.count({ where: { enrollmentId: row.id } }),
    ).toBe(1);
  });

  it('publishes a quiz snapshot without exposing answer keys and keeps it after the bank changes', async () => {
    const question = await root.assessmentQuestion.create({
      data: {
        tenantId: own.tenantId,
        topic: 'Phiên bản',
        prompt: 'Câu hỏi cũ',
        type: 'TRUE_FALSE',
        options: ['Đúng', 'Sai'],
        correctOptions: [1],
        explanation: 'Đáp án cũ',
      },
    });
    const quiz = await root.quiz.create({
      data: {
        tenantId: own.tenantId,
        name: 'Đề cố định',
        selectionMode: 'FIXED',
        timeLimitMinutes: 5,
        passingScore: 70,
        maxAttempts: 2,
      },
    });
    await root.quizQuestion.create({
      data: {
        tenantId: own.tenantId,
        quizId: quiz.id,
        questionId: question.id,
        position: 0,
      },
    });
    const course = await root.trainingCourse.create({
      data: {
        tenantId: own.tenantId,
        name: 'Khóa có phiên bản đề',
        description: '',
        status: 'IN_REVIEW',
        reviewToken: randomUUID(),
        authorId: own.users[1].id,
      },
    });
    const module = await root.trainingModule.create({
      data: {
        tenantId: own.tenantId,
        courseId: course.id,
        name: 'Mở đầu',
        position: 0,
      },
    });
    const lesson = await root.trainingLesson.create({
      data: {
        tenantId: own.tenantId,
        moduleId: module.id,
        name: 'Thi',
        type: 'QUIZ',
        durationMinutes: 5,
        position: 0,
        quizId: quiz.id,
      },
    });
    await request(app.getHttpServer())
      .post('/training/reviews/courses/' + course.id + '/approve')
      .set('Origin', webOrigin())
      .set('Cookie', admin)
      .send({ token: course.reviewToken })
      .expect(200);
    const release = await root.trainingRelease.findFirstOrThrow({
      where: { courseId: course.id },
    });
    await root.assessmentQuestion.update({
      where: { id: question.id },
      data: { prompt: 'Câu hỏi mới', correctOptions: [2] },
    });
    const row = await root.enrollment.create({
      data: {
        ...enrollmentInput(),
        courseId: course.id,
        courseVersionId: release.id,
      },
    });
    const path = '/' + row.id + '/lessons/' + lesson.id + '/quiz/';
    const { attempt } = (
      await api('post', path + 'start')
        .send({})
        .expect(200)
    ).body;
    expect(attempt.questions).toEqual([
      { type: 'TRUE_FALSE', prompt: 'Câu hỏi cũ', options: ['Đúng', 'Sai'] },
    ]);
    await api('post', path + 'review')
      .send({ attemptId: attempt.id })
      .expect(404);
    await api('post', path + 'save')
      .send({ attemptId: attempt.id, answers: { 0: [1] } })
      .expect(200);
    await api('post', path + 'submit')
      .send({ attemptId: attempt.id })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: 'COMPLETED',
          attempt: { score: 100 },
        });
        expect(body.attempt.questions[0]).not.toHaveProperty('correctOptions');
      });
    await api('post', path + 'review')
      .send({ attemptId: attempt.id })
      .expect(200)
      .expect(({ body }) => {
        expect(body.questions[0]).not.toHaveProperty('correctOptions');
      });
  });

  afterAll(async () => {
    try {
      for (const fixture of [own, other]) {
        if (!fixture) continue;
        const { tenantId } = fixture;
        await root.enrollment.updateMany({
          where: { tenantId },
          data: { status: 'CANCELLED', completedAt: null },
        });
        await root.enrollment.deleteMany({
          where: { tenantId, previousEnrollmentId: { not: null } },
        });
        await root.enrollment.deleteMany({ where: { tenantId } });
        await root.trainingCourse.deleteMany({ where: { tenantId } });
        await root.quiz.deleteMany({ where: { tenantId } });
        await root.assessmentQuestion.deleteMany({ where: { tenantId } });
        await root.authCredential.deleteMany({ where: { tenantId } });
        await removeTenantFixture(root, tenantId);
      }
    } finally {
      await app?.close();
      await root.$disconnect();
    }
  });

  it('enforces tenant row isolation and validates the course/version foreign key', async () => {
    const database = app.get(TenantDatabase);
    await database.run(own.tenantId, async () => {
      expect(
        await database.client.enrollment.findUnique({
          where: { id: otherEnrollmentId },
        }),
      ).toBeNull();
      expect(
        await database.client.enrollment.updateMany({
          where: { id: otherEnrollmentId },
          data: { progressPercent: 50 },
        }),
      ).toEqual({ count: 0 });
    });
    const wrongCourse = await course(own.tenantId, 'Khóa khác');
    await expect(
      root.enrollment.create({
        data: { ...enrollmentInput(), courseVersionId: wrongCourse.version.id },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    const foreign = await root.enrollment.findUniqueOrThrow({
      where: { id: otherEnrollmentId },
    });
    await expect(
      database.run(own.tenantId, () =>
        database.client.enrollment.create({
          data: {
            tenantId: foreign.tenantId,
            userId: foreign.userId,
            courseId: foreign.courseId,
            courseVersionId: foreign.courseVersionId,
            source: foreign.source,
            dueAt: foreign.dueAt,
            status: 'FAILED',
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('pins content, preserves overdue access, unlocks lessons and isolates every endpoint', async () => {
    const enrollment = await root.enrollment.create({
      data: enrollmentInput(new Date('2020-01-01T00:00:00Z')),
    });
    const path = '/' + enrollment.id;
    const firstPath = path + '/lessons/' + first;
    const videoPath = path + '/lessons/' + second;
    const videoProgress = { duration: 20, position: 5 };

    await expect(
      root.enrollment.create({ data: enrollmentInput() }),
    ).rejects.toMatchObject({ code: 'P2002' });
    const newVersion = await root.trainingRelease.create({
      data: {
        tenantId: own.tenantId,
        courseId,
        revision: 2,
        content: snapshot('Phiên bản mới', 'Nội dung mới'),
      },
    });
    await api('get')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toContainEqual(
          expect.objectContaining({
            id: enrollment.id,
            status: 'OVERDUE',
            title: 'Phiên bản đã giao',
          }),
        );
      });
    await api('get', '', teammate).expect(200, []);
    for (const [method, action] of [
      ['get', ''],
      ['post', '/lessons/' + first + '/open'],
      ['get', '/lessons/' + first + '/file'],
      ['post', '/lessons/' + first + '/complete'],
      ['post', '/lessons/' + second + '/video'],
    ] as const) {
      await api(method, '/' + otherEnrollmentId + action)
        .send(videoProgress)
        .expect(404);
      await api(method, path + action, teammate)
        .send(videoProgress)
        .expect(404);
    }
    await api('post', videoPath + '/open').expect(403);
    await api('post', firstPath + '/open')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ title: 'Văn bản', body: 'Nội dung' });
      });
    await api('post', firstPath + '/complete').expect(200);
    await api('post', videoPath + '/open').expect(200);
    await api('post', videoPath + '/video')
      .send({ duration: 20, position: 18 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ completed: false, resumePosition: 18 });
      });
    await api('post', videoPath + '/open')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ completed: false, resumePosition: 18 });
      });
    await api('post', videoPath + '/video')
      .send({ duration: 20, from: 0, position: 10 })
      .expect(200);
    await api('post', videoPath + '/video')
      .send({ duration: 20, from: 8, position: 16 })
      .expect(200)
      .expect(({ body }) => {
        expect(body.completed).toBe(true);
      });
    await api('post', path + '/lessons/' + third + '/open')
      .expect(200)
      .expect(({ body }) => {
        expect(body.body).toBe('Nội dung cũ');
      });
    await api('post', path + '/lessons/' + third + '/complete').expect(200);
    await root.enrollment.update({
      where: { id: enrollment.id },
      data: { status: 'FAILED' },
    });
    const reassigned = await root.enrollment.create({
      data: {
        ...enrollmentInput(),
        courseVersionId: newVersion.id,
        previousEnrollmentId: enrollment.id,
      },
    });
    await api('get', '/' + reassigned.id)
      .expect(200)
      .expect(({ body }) => {
        expect(body.modules[0].lessons).toMatchObject([
          { completed: true, locked: false },
          { completed: true, locked: false },
          { completed: false, locked: false },
        ]);
      });
    await api('post', '/' + reassigned.id + '/lessons/' + third + '/open')
      .expect(200)
      .expect(({ body }) => {
        expect(body.body).toBe('Nội dung mới');
      });
    const source = await root.enrollment.findUniqueOrThrow({
      where: { id: enrollment.id },
    });
    expect(source.status).toBe('FAILED');
    expect(source.progressPercent).toBe(100);
  });
});
