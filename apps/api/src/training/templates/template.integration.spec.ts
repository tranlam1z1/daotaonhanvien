import 'reflect-metadata';
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { webOrigin } from '../../auth/auth-policy';
import { LeadInfrastructure } from '../../leads/leads.infrastructure';
import {
  createTenantFixture,
  removeTenantFixture,
} from '../../testing/tenant-fixture';

const integration =
  process.env.TENANT_INTEGRATION_TEST === 'true' ? describe : describe.skip;
const password = 'TestPassword36!';
const editor = '/training/editor';
const library = '/training/templates';

integration('T17 training template copies', () => {
  const root = new PrismaClient();
  let app: INestApplication;
  let own: Awaited<ReturnType<typeof createTenantFixture>>;
  let other: typeof own;
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
      [method](route)
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
    other = await createTenantFixture(root, passwordHash);
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
    [admin, otherAdmin, trainer, employee] = await Promise.all([
      login(own.users[0].email),
      login(other.users[0].email),
      login(own.users[2].email),
      login(own.users[1].email),
    ]);
  });

  afterAll(async () => {
    try {
      for (const fixture of [own, other]) {
        if (!fixture) continue;
        const where = { tenantId: fixture.tenantId };
        await root.programCourse.deleteMany({ where });
        await root.trainingProgram.deleteMany({ where });
        await root.trainingCourse.deleteMany({ where });
        await removeTenantFixture(root, fixture.tenantId);
      }
    } finally {
      await app?.close();
      await root.$disconnect();
    }
  });

  const provenance = (sourceItemId: string, customized = false) => ({
    sourceItemId,
    sourceVersion: 'onboarding-1',
    customized,
  });

  async function copy(source: string, cookie = admin) {
    return (
      await api('post', library + '/' + source + '/copy', cookie)
        .send({})
        .expect(201)
    ).body;
  }

  async function course(id: string, cookie = admin) {
    return (await api('get', editor + '/courses/' + id, cookie).expect(200))
      .body;
  }

  it('copies a complete program in release order and reads source provenance from stored drafts', async () => {
    const result = await copy('program/onboarding');
    const catalog = (await api('get', editor).expect(200)).body;
    const program = catalog.programs.find(
      (entry: { id: string }) => entry.id === result.programId,
    );
    expect(program).toMatchObject({
      templateSource: provenance('onboarding'),
      courses: result.courseIds.map((courseId: string) => ({ courseId })),
    });
    for (const [index, source] of ['first-week', 'teamwork'].entries()) {
      expect(await course(result.courseIds[index])).toMatchObject({
        status: 'DRAFT',
        templateSource: provenance(source),
      });
    }
    const resultCourse = await course(result.courseIds[0]);
    expect(resultCourse.modules).toMatchObject([
      {
        templateSource: provenance('before-starting'),
        lessons: [
          { templateSource: provenance('work-tools') },
          { templateSource: provenance('contact-person') },
        ],
      },
      {
        templateSource: provenance('first-day'),
        lessons: [{ templateSource: provenance('first-meeting') }],
      },
    ]);
    const otherCatalog = (await api('get', editor, otherAdmin).expect(200))
      .body;
    expect(otherCatalog.programs).not.toContainEqual(
      expect.objectContaining({ id: result.programId }),
    );
  });

  it('publishes copied programs and courses only after their own approval', async () => {
    await root.tenant.update({
      where: { id: own.tenantId },
      data: { config: { selfApproval: false } },
    });
    await root.userRole.create({
      data: {
        tenantId: own.tenantId,
        userId: own.users[2].id,
        role: 'PD',
        departmentIds: [own.department.id],
      },
    });
    const reviewer = await login(own.users[2].email);
    const { programId, courseIds } = (
      await api('post', library + '/program/onboarding/copy')
        .send({ departmentId: own.department.id })
        .expect(201)
    ).body;
    const [courseId, secondCourseId] = courseIds;
    const catalog = (await api('get', editor).expect(200)).body;
    const program = catalog.programs.find(
      (entry: { id: string }) => entry.id === programId,
    );
    expect(program.status).toBe('DRAFT');
    const stagedCourse = await course(courseId);
    expect(stagedCourse.status).toBe('DRAFT');

    const programPath = '/programs/' + programId;
    const coursePath = '/courses/' + courseId;
    const reader = '/training/read';
    const reviews = '/training/reviews';
    const assignable = '/training/assignable' + coursePath;
    await api('get', reader + programPath, employee).expect(404);
    await api('get', reader + coursePath, employee).expect(404);
    await api('get', assignable).expect(404);

    const queued: Record<string, string> = {};
    for (const [route, revision] of [
      [programPath, program.revision],
      [coursePath, stagedCourse.revision],
    ]) {
      const workflow = editor + route + '/workflow';
      await api('post', workflow + '/publish')
        .send({ revision })
        .expect(403);
      const submission = (
        await api('post', workflow + '/submit')
          .send({ revision })
          .expect(200)
      ).body;
      expect(submission.status).toBe('IN_REVIEW');
      queued[route] = submission.reviewToken;
      await api('get', reader + route, employee).expect(404);
      await api('post', reviews + route + '/approve')
        .send({ token: submission.reviewToken })
        .expect(403);
      await api('post', reviews + route + '/approve', otherAdmin)
        .send({ token: submission.reviewToken })
        .expect(404);
    }
    await api('get', assignable).expect(404);

    const publishedProgram = await api(
      'post',
      reviews + programPath + '/approve',
      reviewer,
    )
      .send({ token: queued[programPath] })
      .expect(200);
    expect(publishedProgram.body.status).toBe('PUBLISHED');
    await api('get', reader + programPath, employee).expect(200);
    await api('get', reader + coursePath, employee).expect(404);
    await api('get', assignable).expect(404);

    const publishedCourse = await api(
      'post',
      reviews + coursePath + '/approve',
      reviewer,
    )
      .send({ token: queued[coursePath] })
      .expect(200);
    expect(publishedCourse.body.status).toBe('PUBLISHED');
    const { body: visible } = await api(
      'get',
      reader + coursePath,
      employee,
    ).expect(200);
    await api('get', assignable).expect(200, {
      courseId,
      versionId: visible.versionId,
      revision: stagedCourse.revision,
    });
    await api('get', reader + '/courses/' + secondCourseId, employee).expect(
      404,
    );

    const release = await root.trainingRelease.findUniqueOrThrow({
      where: { id: visible.versionId },
    });
    expect(release.content).toMatchObject({
      templateSource: provenance('first-week'),
      modules: [
        {
          templateSource: provenance('before-starting'),
          lessons: [
            { templateSource: provenance('work-tools') },
            { templateSource: provenance('contact-person') },
          ],
        },
        {
          templateSource: provenance('first-day'),
          lessons: [{ templateSource: provenance('first-meeting') }],
        },
      ],
    });
  });

  it('preserves a changed program order and marks the program as customized', async () => {
    const { programId, courseIds } = await copy('program/onboarding');
    const catalog = (await api('get', editor).expect(200)).body;
    const program = catalog.programs.find(
      (entry: { id: string }) => entry.id === programId,
    );
    const reversed = [...courseIds].reverse();

    const updated = (
      await api('patch', editor + '/programs/' + programId)
        .send({ ...program, courseIds: reversed })
        .expect(200)
    ).body;

    expect(updated.templateSource).toEqual(provenance('onboarding', true));
    expect(updated.courses).toEqual(
      reversed.map((courseId: string) => ({ courseId })),
    );
    expect((await course(reversed[0])).templateSource).toEqual(
      provenance('teamwork'),
    );
  });

  it('copies the selected course, module or lesson without its siblings', async () => {
    const cases = [
      {
        path: 'course/first-week',
        source: 'first-week',
        module: 'before-starting',
        moduleCount: 2,
        lessonCount: 2,
      },
      {
        path: 'module/before-starting',
        source: null,
        module: 'before-starting',
        moduleCount: 1,
        lessonCount: 2,
      },
      {
        path: 'lesson/contact-person',
        source: null,
        module: null,
        moduleCount: 1,
        lessonCount: 1,
      },
    ];
    for (const entry of cases) {
      const { programId, courseIds } = await copy(entry.path);
      expect(programId).toBeNull();
      expect(courseIds).toHaveLength(1);
      const draft = await course(courseIds[0]);
      expect(draft.status).toBe('DRAFT');
      expect(draft.templateSource).toEqual(
        entry.source ? provenance(entry.source) : null,
      );
      expect(draft.modules).toHaveLength(entry.moduleCount);
      expect(draft.modules[0].templateSource).toEqual(
        entry.module ? provenance(entry.module) : null,
      );
      expect(draft.modules[0].lessons).toHaveLength(entry.lessonCount);
      expect(draft.modules[0].lessons.at(-1).templateSource).toEqual(
        provenance('contact-person'),
      );
    }
  });

  it('limits catalog and copy to ADM or in-scope PTĐT', async () => {
    await api('get', library, employee).expect(403);
    await api('get', library, trainer).expect(200);
    await api('post', library + '/lesson/work-tools/copy', employee)
      .send({})
      .expect(403);
    await api('post', library + '/lesson/work-tools/copy', trainer)
      .send({})
      .expect(403);
    await api('post', library + '/lesson/work-tools/copy', trainer)
      .send({ departmentId: other.department.id })
      .expect(403);
    await api('post', library + '/lesson/work-tools/copy')
      .send({ departmentId: other.department.id })
      .expect(400);
    const result = await api(
      'post',
      library + '/lesson/work-tools/copy',
      trainer,
    )
      .send({ departmentId: own.department.id, tenantId: other.tenantId })
      .expect(201);
    expect((await course(result.body.courseIds[0], trainer)).departmentId).toBe(
      own.department.id,
    );
    await api(
      'get',
      editor + '/courses/' + result.body.courseIds[0],
      otherAdmin,
    ).expect(404);
    await api('post', library + '/lesson/before-starting/copy')
      .send({})
      .expect(404);
  });

  it('keeps the original release and the other tenant copy intact after editing a draft', async () => {
    const original = (await api('get', library).expect(200)).body;
    const ownId = (await copy('course/first-week')).courseIds[0];
    const otherId = (await copy('course/first-week', otherAdmin)).courseIds[0];
    const ownCopy = await course(ownId);
    const otherCopy = await course(otherId, otherAdmin);
    const route = editor + '/courses/' + ownId;

    await api('patch', route, otherAdmin).send(ownCopy).expect(404);
    await api('get', editor + '/courses/' + otherId).expect(404);
    const unchanged = (await api('patch', route).send(ownCopy).expect(200))
      .body;
    expect(unchanged.templateSource).toEqual(provenance('first-week'));
    expect(unchanged.modules[0].templateSource).toEqual(
      provenance('before-starting'),
    );
    expect(unchanged.modules[0].lessons[0].templateSource).toEqual(
      provenance('work-tools'),
    );

    unchanged.name = 'Khóa đã sửa';
    unchanged.modules[0].name = 'Module đã sửa';
    unchanged.modules[0].lessons[0].body = 'Bài đã sửa';
    await api('patch', route).send(unchanged).expect(200);
    const edited = await course(ownId);
    expect(edited.templateSource).toEqual(provenance('first-week', true));
    expect(edited.modules[0].templateSource).toEqual(
      provenance('before-starting', true),
    );
    expect(edited.modules[0].lessons[0].templateSource).toEqual(
      provenance('work-tools', true),
    );
    expect(edited.modules[0].lessons[1].templateSource).toEqual(
      provenance('contact-person'),
    );
    expect(await course(otherId, otherAdmin)).toEqual(otherCopy);
    expect((await api('get', library).expect(200)).body).toEqual(original);
  });
});
