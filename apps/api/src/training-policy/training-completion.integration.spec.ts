import 'reflect-metadata';
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';
import request from 'supertest';
import { AppModule } from '../app.module';
import { webOrigin } from '../auth/auth-policy';
import { LeadInfrastructure } from '../leads/leads.infrastructure';
import {
  createTenantFixture,
  removeTenantFixture,
} from '../testing/tenant-fixture';
import { TrainingModule } from '../training/training.module';

const integration =
  process.env.TENANT_INTEGRATION_TEST === 'true' ? describe : describe.skip;
const password = 'TestPassword36!';

integration('T15 training duration and completion', () => {
  const root = new PrismaClient();
  let app: INestApplication;
  let own: Awaited<ReturnType<typeof createTenantFixture>>;
  let other: typeof own;
  let admin: string;
  let otherAdmin: string;

  function api(method: 'get' | 'post' | 'patch', path: string, cookie = admin) {
    return request(app.getHttpServer())
      [method]('/training/editor' + path)
      .set('Origin', webOrigin())
      .set('Cookie', cookie);
  }

  async function login(identifier: string) {
    const logged = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', webOrigin())
      .send({ identifier, password })
      .expect(204);
    return logged.headers['set-cookie'][0].split(';')[0] as string;
  }

  const courseInput = {
    name: 'Khóa học T15',
    description: '',
    modules: [
      {
        name: 'Module T15',
        lessons: [
          {
            name: 'Bài học',
            durationMinutes: 60,
            type: 'TEXT',
            body: 'Nội dung',
          },
        ],
      },
    ],
  };
  const programInput = {
    name: 'Chương trình T15',
    description: 'Nội dung chương trình',
    audience: 'Nhân viên mới',
    type: 'ONBOARDING',
    targetDuration: 1,
    targetUnit: 'HOURS',
  };

  beforeAll(async () => {
    const passwordHash = await hash(password);
    own = await createTenantFixture(root, passwordHash);
    other = await createTenantFixture(root, passwordHash);
    const module = await Test.createTestingModule({
      imports: [AppModule, TrainingModule],
    })
      .overrideProvider(LeadInfrastructure)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    await app.init();
    [admin, otherAdmin] = await Promise.all([
      login(own.users[0].email),
      login(other.users[0].email),
    ]);
  });

  afterAll(async () => {
    try {
      for (const fixture of [own, other]) {
        if (!fixture) continue;
        const where = { tenantId: fixture.tenantId };
        await root.trainingProgram.deleteMany({ where });
        await root.trainingCourse.deleteMany({ where });
        await removeTenantFixture(root, fixture.tenantId);
      }
    } finally {
      await app?.close();
      await root.$disconnect();
    }
  });

  it('updates shared program totals and saves course settings independently', async () => {
    await root.tenant.update({
      where: { id: own.tenantId },
      data: { config: { completion: { lessonPercent: 85, maxAttempts: 4 } } },
    });
    const course = (await api('post', '/courses').send(courseInput).expect(201))
      .body;
    const second = (await api('post', '/courses').send(courseInput).expect(201))
      .body;
    expect(course).toMatchObject({
      totalDurationMinutes: 60,
      learningMode: 'SEQUENTIAL',
      completion: { lessonPercent: 85, maxAttempts: 4 },
    });

    const hour = (
      await api('post', '/programs')
        .send({ ...programInput, courseIds: [course.id] })
        .expect(201)
    ).body;
    const day = (
      await api('post', '/programs')
        .send({ ...programInput, courseIds: [course.id], targetUnit: 'DAYS' })
        .expect(201)
    ).body;
    expect(hour).toMatchObject({
      totalDurationMinutes: 60,
      exceedsTarget: false,
    });

    const module = course.modules[0];
    const changed = {
      lessonRequired: false,
      lessonPercent: 90,
      finalScoreRequired: false,
      finalScorePercent: 80,
      attemptLimitEnabled: false,
      maxAttempts: 2,
      practiceRequired: true,
    };
    await api('patch', '/courses/' + course.id)
      .send({
        ...course,
        completion: changed,
        learningMode: 'FREE',
        modules: [
          {
            ...module,
            lessons: [{ ...module.lessons[0], durationMinutes: 1441 }],
          },
        ],
      })
      .expect(200);
    const reopened = (await api('get', '/courses/' + course.id).expect(200))
      .body;
    expect(reopened).toMatchObject({
      completion: changed,
      learningMode: 'FREE',
      totalDurationMinutes: 1441,
    });
    await root.tenant.update({
      where: { id: own.tenantId },
      data: { config: { completion: { lessonPercent: 95 } } },
    });
    const secondReopened = (
      await api('get', '/courses/' + second.id).expect(200)
    ).body;
    expect(secondReopened).toMatchObject({
      totalDurationMinutes: 60,
      learningMode: 'SEQUENTIAL',
      completion: { lessonPercent: 85, maxAttempts: 4 },
    });

    const catalog = (await api('get', '').expect(200)).body;
    expect(catalog.programs).toEqual(
      expect.arrayContaining(
        [hour.id, day.id].map((id) =>
          expect.objectContaining({
            id,
            totalDurationMinutes: 1441,
            exceedsTarget: true,
          }),
        ),
      ),
    );
    const detached = (
      await api('patch', '/programs/' + hour.id)
        .send({ ...programInput, revision: hour.revision, courseIds: [] })
        .expect(200)
    ).body;
    expect(detached).toMatchObject({
      totalDurationMinutes: 0,
      exceedsTarget: false,
    });
  });

  it('keeps program durations and course criteria inside the session tenant', async () => {
    const foreign = (
      await api('post', '/courses', otherAdmin).send(courseInput).expect(201)
    ).body;
    const program = (
      await api('post', '/programs', otherAdmin)
        .send({ ...programInput, courseIds: [foreign.id] })
        .expect(201)
    ).body;
    const catalog = (await api('get', '').expect(200)).body;
    expect(catalog.courses.map(({ id }: { id: string }) => id)).not.toContain(
      foreign.id,
    );
    expect(catalog.programs.map(({ id }: { id: string }) => id)).not.toContain(
      program.id,
    );
    await api('get', '/courses/' + foreign.id).expect(404);
    await api('patch', '/courses/' + foreign.id)
      .send({
        ...courseInput,
        revision: foreign.revision,
        learningMode: 'FREE',
      })
      .expect(404);
    await api('patch', '/programs/' + program.id)
      .send({ ...programInput, revision: program.revision, courseIds: [] })
      .expect(404);
    await api('post', '/programs')
      .send({ ...programInput, courseIds: [foreign.id] })
      .expect(400);
    const reopened = (
      await api('get', '/courses/' + foreign.id, otherAdmin).expect(200)
    ).body;
    expect(reopened).toMatchObject({
      learningMode: 'SEQUENTIAL',
      totalDurationMinutes: 60,
    });
  });
});
