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
import {
  createTenantFixture,
  removeTenantFixture,
} from '../testing/tenant-fixture';
import { assignmentDeadline, dayMs } from './assignment-input';

const integration =
  process.env.TENANT_INTEGRATION_TEST === 'true' ? describe : describe.skip;
const password = 'TestPassword36!';

function date(days: number) {
  return new Date(Date.now() + days * dayMs).toISOString().slice(0, 10);
}

integration('F06 assignment management', () => {
  const root = new PrismaClient();
  let app: INestApplication;
  let own: Awaited<ReturnType<typeof createTenantFixture>>;
  let other: typeof own;
  let admin: string;
  let employee: string;
  let foreign: string;
  let scopedEditor: string;

  function api(
    method: 'get' | 'post' | 'patch',
    path = '',
    cookie = admin,
    base = '/assignments',
  ) {
    return request(app.getHttpServer())
      [method](base + path)
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

  async function publishCourse(
    fixture: typeof own,
    name: string,
    departmentId: string | null = fixture.department.id,
  ) {
    const { tenantId } = fixture;
    const course = await root.trainingCourse.create({
      data: {
        tenantId,
        departmentId,
        name,
        description: name,
        status: 'PUBLISHED',
      },
    });
    const release = await root.trainingRelease.create({
      data: {
        tenantId,
        departmentId,
        courseId: course.id,
        revision: 1,
        content: { name, description: name, modules: [] },
      },
    });
    return { course, release };
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
    admin = await login(own.users[0].email);
    employee = await login(own.users[1].email);
    foreign = await login(other.users[0].email);
    scopedEditor = await login(own.users[2].email);
  });

  afterAll(async () => {
    try {
      for (const fixture of [own, other]) {
        if (!fixture) continue;
        const { tenantId } = fixture;
        await root.enrollment.deleteMany({ where: { tenantId } });
        await root.assignmentRule.deleteMany({ where: { tenantId } });
        await root.trainingProgram.deleteMany({ where: { tenantId } });
        await root.trainingCourse.deleteMany({ where: { tenantId } });
        await removeTenantFixture(root, tenantId);
      }
    } finally {
      await app?.close();
      await root.$disconnect();
    }
  });

  it('AC-07 keeps one effective enrollment and the later deadline under concurrent requests', async () => {
    const { course, release } = await publishCourse(own, 'Chống giao trùng');
    const body = {
      kind: 'course',
      targetId: course.id,
      userIds: [own.users[1].id],
    };
    const shorter = date(3);
    const longer = date(5);
    const [first, second] = await Promise.all([
      api('post')
        .send({ ...body, dueDate: shorter })
        .expect(201),
      api('post')
        .send({ ...body, dueDate: longer })
        .expect(201),
    ]);
    expect(first.body.created + second.body.created).toBe(1);

    const updated = await root.enrollment.findMany({
      where: {
        tenantId: own.tenantId,
        userId: own.users[1].id,
        courseId: course.id,
      },
    });
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      courseVersionId: release.id,
      dueAt: assignmentDeadline(longer),
      status: 'NOT_STARTED',
    });
    expect(
      (
        await api(
          'get',
          '?courseId=' + course.id + '&status=NOT_STARTED',
        ).expect(200)
      ).body,
    ).toEqual([
      expect.objectContaining({ id: updated[0].id, courseName: course.name }),
    ]);
  });

  it('AC-05 and AC-09 pin the assigned release, allow overdue extension, and keep a reassign history', async () => {
    const { course, release } = await publishCourse(own, 'Hạn và giao lại');
    const userId = own.users[1].id;
    const old = await root.enrollment.create({
      data: {
        tenantId: own.tenantId,
        userId,
        courseId: course.id,
        courseVersionId: release.id,
        dueAt: assignmentDeadline(date(-1)),
        source: 'MANUAL',
      },
    });
    const nextRelease = await root.trainingRelease.create({
      data: {
        tenantId: own.tenantId,
        courseId: course.id,
        departmentId: own.department.id,
        revision: 2,
        content: { name: 'Phiên bản mới', modules: [] },
      },
    });
    const list = await api(
      'get',
      '?courseId=' + course.id + '&status=OVERDUE',
    ).expect(200);
    expect(list.body).toEqual([
      expect.objectContaining({
        id: old.id,
        courseRevision: 1,
        status: 'OVERDUE',
      }),
    ]);
    await api('patch', '/' + old.id + '/deadline')
      .send({ dueDate: date(4) })
      .expect(200);
    const extended = await root.enrollment.findUniqueOrThrow({
      where: { id: old.id },
    });
    expect(extended).toMatchObject({
      status: 'NOT_STARTED',
      courseVersionId: release.id,
    });
    await api('post', '/' + old.id + '/cancel').expect(200);
    expect(
      await root.enrollment.findUnique({ where: { id: old.id } }),
    ).toMatchObject({ status: 'CANCELLED' });

    const failed = await root.enrollment.create({
      data: {
        tenantId: own.tenantId,
        userId,
        courseId: course.id,
        courseVersionId: release.id,
        dueAt: assignmentDeadline(date(1)),
        source: 'MANUAL',
        status: 'FAILED',
      },
    });
    await api('post', '/' + failed.id + '/reassign')
      .send({ dueDate: date(5) })
      .expect(201, { created: 1, extended: 0 });
    expect(
      await root.enrollment.findFirst({
        where: { previousEnrollmentId: failed.id },
      }),
    ).toMatchObject({
      courseVersionId: nextRelease.id,
      userId,
      status: 'NOT_STARTED',
    });
    expect(
      await root.enrollment.findUnique({ where: { id: failed.id } }),
    ).toMatchObject({ status: 'FAILED' });
  });

  it('assigns all courses in the latest published program to a department with a shared deadline', async () => {
    const one = await publishCourse(own, 'Hội nhập một');
    const two = await publishCourse(own, 'Hội nhập hai');
    const { tenantId } = own;
    const program = await root.trainingProgram.create({
      data: {
        tenantId,
        departmentId: own.department.id,
        name: 'Chương trình hội nhập',
        description: '',
        audience: '',
        type: 'ONBOARDING',
        targetDuration: 1,
        targetUnit: 'DAYS',
      },
    });
    await root.trainingRelease.create({
      data: {
        tenantId,
        programId: program.id,
        departmentId: own.department.id,
        revision: 1,
        content: {
          name: program.name,
          courses: [{ courseId: one.course.id }, { courseId: two.course.id }],
        },
      },
    });
    const dueDate = date(4);
    const result = await api('post')
      .send({
        kind: 'program',
        targetId: program.id,
        departmentId: own.department.id,
        dueDate,
      })
      .expect(201);
    expect(result.body.created).toBe(6);
    expect(
      await root.enrollment.findMany({
        where: { tenantId, programId: program.id },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          courseId: one.course.id,
          dueAt: assignmentDeadline(dueDate),
        }),
        expect.objectContaining({
          courseId: two.course.id,
          dueAt: assignmentDeadline(dueDate),
        }),
      ]),
    );
  });

  it('AC-06 applies rules on creation and profile transfer, and on request to existing employees', async () => {
    const { course } = await publishCourse(own, 'Phân bổ tự động');
    const { tenantId } = own;
    const condition = {
      name: 'Hội nhập vận hành',
      kind: 'course',
      targetId: course.id,
      departmentId: own.department.id,
      positionId: own.position.id,
      dueDays: 3,
      applyExisting: false,
    };
    const { body } = await api('post', '/rules').send(condition).expect(201);
    expect(body.applied.created).toBe(0);

    const profile = {
      fullName: 'Nhân viên mới',
      positionId: own.position.id,
      departmentId: own.department.id,
      joinedAt: date(0),
    };
    const created = await api('post', '', admin, '/employees')
      .send({
        ...profile,
        employeeCode: 'F06-1',
        email: 'hoc1@' + tenantId + '.example',
      })
      .expect(201);
    const assigned = await root.enrollment.findFirstOrThrow({
      where: { tenantId, userId: created.body.id, courseId: course.id },
    });
    expect(assigned).toMatchObject({
      ruleId: body.rule.id,
      source: 'AUTOMATIC',
    });
    expect(assigned.dueAt.valueOf() - assigned.assignedAt.valueOf()).toBe(
      3 * dayMs,
    );

    const transferProfile = {
      ...profile,
      employeeCode: 'F06-2',
      email: 'hoc2@' + tenantId + '.example',
    };
    const transferred = await api('post', '', admin, '/employees')
      .send({ ...transferProfile, departmentId: null })
      .expect(201);
    expect(
      await root.enrollment.count({
        where: { tenantId, userId: transferred.body.id },
      }),
    ).toBe(0);
    await api('patch', '/' + transferred.body.id, admin, '/employees')
      .send(transferProfile)
      .expect(200);
    await api('patch', '/' + transferred.body.id, admin, '/employees')
      .send({ ...transferProfile, departmentId: null })
      .expect(200);
    expect(
      await root.enrollment.findFirst({
        where: { tenantId, userId: transferred.body.id },
      }),
    ).toMatchObject({ status: 'NOT_STARTED', courseId: course.id });

    const existingUser = own.users[1].id;
    await api('post')
      .send({
        kind: 'course',
        targetId: course.id,
        userIds: [existingUser],
        dueDate: date(1),
      })
      .expect(201);
    const manual = await root.enrollment.findFirstOrThrow({
      where: { tenantId, userId: existingUser, courseId: course.id },
    });
    const updated = await api('patch', '/rules/' + body.rule.id)
      .send({ ...condition, applyExisting: true })
      .expect(200);
    expect(updated.body.applied.created).toBe(2);
    const overlap = await root.enrollment.findMany({
      where: { tenantId, userId: existingUser, courseId: course.id },
    });
    expect(overlap).toHaveLength(1);
    expect(overlap[0]).toMatchObject({ id: manual.id, source: 'MANUAL' });
    expect(overlap[0].dueAt.valueOf()).toBeGreaterThan(manual.dueAt.valueOf());
    expect((await api('get', '/rules').expect(200)).body).toContainEqual(
      expect.objectContaining({ id: body.rule.id }),
    );
  });

  it('keeps all HTTP reads and writes within tenant and department scope', async () => {
    const { course } = await publishCourse(other, 'Ngoài doanh nghiệp');
    const dueDate = date(3);
    await api('post', '', foreign)
      .send({
        kind: 'course',
        targetId: course.id,
        userIds: [other.users[1].id],
        dueDate,
      })
      .expect(201);
    const foreignRow = await root.enrollment.findFirstOrThrow({
      where: { tenantId: other.tenantId, courseId: course.id },
    });
    const ruleBody = {
      name: 'Ngoài doanh nghiệp',
      kind: 'course',
      targetId: course.id,
      departmentId: other.department.id,
      dueDays: 3,
      applyExisting: false,
    };
    const foreignRule = (
      await api('post', '/rules', foreign).send(ruleBody).expect(201)
    ).body.rule;

    await api('get', '?courseId=' + course.id).expect(200, []);
    expect(
      (await api('get', '/options?tenantId=' + other.tenantId).expect(200)).body
        .targets,
    ).not.toContainEqual(expect.objectContaining({ id: course.id }));
    expect(
      (await api('get', '/rules?tenantId=' + other.tenantId).expect(200)).body,
    ).not.toContainEqual(expect.objectContaining({ id: foreignRule.id }));
    await api('post')
      .send({
        kind: 'course',
        targetId: course.id,
        userIds: [own.users[1].id],
        dueDate,
      })
      .expect(404);
    await api('patch', '/' + foreignRow.id + '/deadline')
      .send({ dueDate })
      .expect(404);
    await api('post', '/' + foreignRow.id + '/cancel').expect(404);
    await api('post', '/' + foreignRow.id + '/reassign')
      .send({ dueDate })
      .expect(404);
    await api('post', '/rules').send(ruleBody).expect(404);
    await api('patch', '/rules/' + foreignRule.id)
      .send(ruleBody)
      .expect(404);
    await api('get', '', employee).expect(403);

    const shared = await publishCourse(own, 'Toàn doanh nghiệp', null);
    await api('post', '', scopedEditor)
      .send({
        kind: 'course',
        targetId: shared.course.id,
        userIds: [own.users[1].id],
        dueDate,
      })
      .expect(404);
    expect(
      await root.enrollment.findUnique({ where: { id: foreignRow.id } }),
    ).toMatchObject({ status: 'NOT_STARTED' });
  });
  it('AC-14 reports the same filtered enrollment rows and exports only that selection', async () => {
    const { course, release } = await publishCourse(own, 'Kiểm tra báo cáo');
    const learner = own.users[1];
    const created = await root.enrollment.create({
      data: {
        tenantId: own.tenantId,
        userId: learner.id,
        courseId: course.id,
        courseVersionId: release.id,
        source: 'MANUAL',
        dueAt: new Date(Date.now() - dayMs),
      },
    });
    const filter = `?courseId=${course.id}`;
    const listing = (await api('get', filter).expect(200)).body;
    const report = (
      await api(
        'get',
        `${filter}&departmentId=${own.department.id}`,
        admin,
        '/reports',
      ).expect(200)
    ).body;
    expect(
      listing.map(({ id, status }: { id: string; status: string }) => ({
        id,
        status,
      })),
    ).toEqual([{ id: created.id, status: 'OVERDUE' }]);
    expect(report.rows).toMatchObject([{ id: created.id, status: 'OVERDUE' }]);
    expect(report.groups.courses).toMatchObject([
      { name: course.name, totals: { OVERDUE: 1 } },
    ]);
    await api('get', filter, employee, '/reports').expect(403);
    const outsider = (await api('get', filter, foreign, '/reports').expect(200))
      .body;
    expect(outsider.rows).toEqual([]);
    const file = await api(
      'get',
      `/export${filter}&departmentId=${own.department.id}`,
      admin,
      '/reports',
    )
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const workbook = new Workbook();
    await workbook.xlsx.load(file.body);
    const sheet = workbook.getWorksheet('Tiến độ');
    expect(sheet?.rowCount).toBe(2);
    expect(sheet?.getCell('C2').value).toBe(course.name);
    expect(sheet?.getCell('E2').value).toBe('Quá hạn');
  });
});
