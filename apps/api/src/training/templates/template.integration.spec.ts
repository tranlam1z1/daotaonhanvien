import { randomUUID } from 'node:crypto';
import 'reflect-metadata';
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { webOrigin } from '../../auth/auth-policy';
import { NoticeCollector } from '../../handover/notice-collector';
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
const platformId = randomUUID();
const platformEmail = platformId + '@example.test';
const templateId = 'template-' + randomUUID();

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
    await root.user.create({
      data: {
        id: platformId,
        email: platformEmail,
        passwordHash,
        fullName: 'Quản trị mẫu',
        status: 'ACTIVE',
        roles: { create: { role: 'QTNT' } },
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
      await root.$executeRaw`DELETE FROM training_template_releases WHERE program_id = ${templateId}`;
      await root.authCredential.deleteMany({ where: { userId: platformId } });
      await root.auditLog.deleteMany({ where: { userId: platformId } });
      await root.userRole.deleteMany({ where: { userId: platformId } });
      await root.user.deleteMany({ where: { id: platformId } });
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

  it('publishes immutable releases and applies a module update in the owning tenant only', async () => {
    const platform = await login(platformEmail);
    const released = {
      industry: 'Dịch vụ',
      positionGroup: 'Nhân viên mới',
      notes: 'Phiên bản đầu tiên',
      program: {
        id: templateId,
        name: 'Hội nhập thử nghiệm',
        description: 'Chương trình thử nghiệm',
        audience: 'Nhân viên',
        type: 'ONBOARDING',
        targetDuration: 1,
        targetUnit: 'HOURS',
        courses: [
          {
            id: 'course-update',
            name: 'Hội nhập',
            description: 'Khóa học thử nghiệm',
            modules: [
              {
                id: 'module-update',
                name: 'Module gốc',
                lessons: [
                  {
                    id: 'lesson-update',
                    name: 'Bài gốc',
                    body: 'Nội dung gốc',
                    durationMinutes: 5,
                  },
                ],
              },
              {
                id: 'module-unrelated',
                name: 'Module khác',
                lessons: [
                  {
                    id: 'lesson-unrelated',
                    name: 'Bài khác',
                    body: 'Nội dung khác',
                    durationMinutes: 5,
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    await api('post', library + '/releases')
      .send(released)
      .expect(403);
    await api('post', library + '/releases', platform)
      .send(released)
      .expect(201);
    const result = await api('post', library + '/course/course-update/copy')
      .send({ programId: templateId })
      .expect(201);
    const id = result.body.courseIds[0] as string;
    const original = await course(id);
    await api('patch', editor + '/courses/' + id)
      .send({
        ...original,
        modules: [
          { ...original.modules[0], name: 'Module tùy chỉnh' },
          original.modules[1],
        ],
      })
      .expect(200);
    await root.tenant.update({
      where: { id: own.tenantId },
      data: { config: { selfApproval: true } },
    });
    const edited = await course(id);
    await api('post', editor + '/courses/' + id + '/workflow/publish')
      .send({ revision: edited.revision })
      .expect(200);
    const before = await course(id);
    expect(before.status).toBe('PUBLISHED');
    const readerPath = '/training/read/courses/' + id;
    const publishedBeforeUpdate = await api('get', readerPath, employee).expect(
      200,
    );
    const [changed, sibling] = released.program.courses[0].modules;
    changed.name = 'Module mẫu mới';
    changed.lessons[0].body = 'Nội dung cập nhật';
    sibling.name = 'Module khác cũng được cập nhật trong mẫu';
    const next = await api('post', library + '/releases', platform)
      .send({ ...released, notes: 'Cập nhật hai module' })
      .expect(201);
    const collector = app.get(NoticeCollector);
    await collector.collectForTenant(own.tenantId);
    await collector.collectForTenant(other.tenantId);
    const eventKey = 'content:template:' + next.body.version;
    const notices = await root.workspaceNotice.findMany({
      where: { eventKey },
    });
    expect(
      notices.map(({ tenantId, userId }) => ({ tenantId, userId })),
    ).toEqual([{ tenantId: own.tenantId, userId: own.users[0].id }]);
    await collector.collectForTenant(own.tenantId);
    expect(await root.workspaceNotice.count({ where: { eventKey } })).toBe(1);
    const updates = library + '/updates/' + id;
    await api('get', updates, otherAdmin).expect(404);
    const list = (await api('get', updates).expect(200)).body;
    expect(list.changes).toContainEqual(
      expect.objectContaining({
        level: 'module',
        id: before.modules[0].id,
        customized: true,
        notes: 'Cập nhật hai module',
        version: next.body.version,
      }),
    );
    const selection = {
      id: before.modules[0].id,
      level: 'module',
      revision: list.revision,
      version: next.body.version,
    };
    await api('post', updates, otherAdmin)
      .send({ ...selection, action: 'replace' })
      .expect(404);
    await api('post', updates)
      .send({ ...selection, action: 'keep' })
      .expect(201);
    expect(await course(id)).toEqual(before);
    await api('post', updates)
      .send({ ...selection, action: 'replace' })
      .expect(201);
    const draft = await course(id);
    expect(draft.status).toBe('DRAFT');
    expect(draft.modules[0]).toMatchObject({
      id: before.modules[0].id,
      name: 'Module mẫu mới',
      templateSource: { sourceVersion: next.body.version, customized: false },
      lessons: [
        { id: before.modules[0].lessons[0].id, body: 'Nội dung cập nhật' },
      ],
    });
    expect(draft.modules[1]).toEqual(before.modules[1]);
    const stillPublished = await api('get', readerPath, employee).expect(200);
    expect(stillPublished.body).toEqual(publishedBeforeUpdate.body);
    const published = await root.trainingRelease.findUniqueOrThrow({
      where: { id: stillPublished.body.versionId },
    });
    const publishedContent = published.content as { modules: unknown[] };
    expect(publishedContent.modules[0]).toMatchObject({
      name: 'Module tùy chỉnh',
      lessons: [{ body: 'Nội dung gốc' }],
    });
    await api('post', updates)
      .send({ ...selection, action: 'replace' })
      .expect(409);
    const stored = await root.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM training_template_releases WHERE program_id = ${templateId}
    `;
    expect(stored[0].count).toBe(2n);
    expect(
      await root.auditLog.count({
        where: { userId: platformId, action: 'PUBLISH_TRAINING_TEMPLATE' },
      }),
    ).toBe(2);
  });
});
