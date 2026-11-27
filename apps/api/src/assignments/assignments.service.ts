import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  EnrollmentSource,
  EnrollmentStatus,
  Prisma,
} from '@prisma/client';
import { permissionProfile, type SessionIdentity } from '../auth/permissions';
import { idInput, object } from '../knowledge/knowledge-input';
import { TenantDatabase } from '../tenant/tenant-database';
import {
  assignmentDeadline,
  manualInput,
  type AssignmentTarget,
} from './assignment-input';

export function assignmentContext(actor: SessionIdentity) {
  const grants = permissionProfile(actor).filter(
    (grant) => grant.permission === 'assignments.manage',
  );
  if (!actor.tenantId || !grants.length) return null;
  return {
    tenantId: actor.tenantId,
    departmentIds: grants.some((grant) => grant.scope === 'tenant')
      ? undefined
      : grants.flatMap((grant) =>
          grant.scope === 'departments' ? grant.departmentIds : [],
        ),
  };
}

export type AssignmentContext = NonNullable<
  ReturnType<typeof assignmentContext>
>;
export type AssignmentActor = { id: string; tenantId: string; ip?: string };

const activeStates: EnrollmentStatus[] = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'OVERDUE',
];
const reassignable: EnrollmentStatus[] = ['FAILED', 'COMPLETED'];
const statuses: EnrollmentStatus[] = [
  ...activeStates,
  ...reassignable,
  'CANCELLED',
];
export const eligibleEmployees: Prisma.UserWhereInput = {
  deletedAt: null,
  status: { in: ['PENDING', 'ACTIVE'] },
};

const releaseSelect = {
  id: true,
  courseId: true,
  programId: true,
  departmentId: true,
  content: true,
} as const;
type Release = Prisma.TrainingReleaseGetPayload<{
  select: typeof releaseSelect;
}>;
type AssignedCourse = { id: string; versionId: string };

function missing() {
  return new NotFoundException(
    'Không tìm thấy lượt học hoặc nội dung trong phạm vi phân bổ.',
  );
}

function allowed(scope: AssignmentContext, departmentId: string | null) {
  return (
    !scope.departmentIds ||
    (departmentId !== null && scope.departmentIds.includes(departmentId))
  );
}

function releaseName(content: Prisma.JsonValue) {
  return (content as { name: string }).name;
}

function programMembers(release: Release) {
  return (release.content as { courses: { courseId: string }[] }).courses.map(
    ({ courseId }) => courseId,
  );
}

@Injectable()
export class AssignmentsService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  private get db() {
    return this.database.client;
  }

  scope(actor: SessionIdentity) {
    const scope = assignmentContext(actor);
    if (!scope)
      throw new ForbiddenException('Bạn không có quyền phân bổ đào tạo.');
    return scope;
  }

  async lockScope(actor: SessionIdentity) {
    const { tenantId } = this.scope(actor);
    await this.db
      .$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
    const user = await this.db.user.findFirst({
      where: {
        tenantId,
        id: actor.id,
        deletedAt: null,
        invitationRequired: false,
        tenant: { status: 'ACTIVE', deletedAt: null },
      },
      select: {
        status: true,
        roles: {
          where: { tenantId, deletedAt: null },
          select: { role: true, departmentIds: true },
        },
      },
    });
    if (!user) throw missing();
    return this.scope({ ...actor, ...user });
  }

  private async releases(
    tenantId: string,
    filter: Prisma.TrainingReleaseWhereInput,
  ) {
    return this.db.trainingRelease.findMany({
      where: { tenantId, ...filter },
      orderBy: { revision: 'desc' },
      distinct: ['courseId', 'programId'],
      select: releaseSelect,
    });
  }

  private coursesForTarget(
    scope: AssignmentContext,
    target: AssignmentTarget,
    courses: Map<string, Release>,
    program?: Release,
  ): AssignedCourse[] | null {
    if (
      target.kind === 'program' &&
      (!program || !allowed(scope, program.departmentId))
    )
      return null;
    const ids = program ? programMembers(program) : [target.id];
    if (!ids.length) return null;
    const selected: AssignedCourse[] = [];
    for (const id of ids) {
      const course = courses.get(id);
      if (!course || !allowed(scope, course.departmentId)) return null;
      selected.push({ id, versionId: course.id });
    }
    return selected;
  }

  async target(scope: AssignmentContext, target: AssignmentTarget) {
    const program =
      target.kind === 'program'
        ? (await this.releases(scope.tenantId, { programId: target.id }))[0]
        : undefined;
    if (target.kind === 'program' && !program) return null;
    const ids = program ? programMembers(program) : [target.id];
    const releases = await this.releases(scope.tenantId, {
      courseId: { in: ids },
    });
    const courses = new Map(
      releases.map((release) => [release.courseId!, release]),
    );
    return this.coursesForTarget(scope, target, courses, program);
  }

  async options(actor: SessionIdentity) {
    const scope = this.scope(actor);
    const { tenantId, departmentIds } = scope;
    const scopedDepartments = departmentIds ? { in: departmentIds } : undefined;
    const [releases, employees, departments, positions] = await Promise.all([
      this.releases(tenantId, {}),
      this.db.user.findMany({
        where: {
          tenantId,
          ...eligibleEmployees,
          departmentId: scopedDepartments,
        },
        select: { id: true, fullName: true, employeeCode: true },
        orderBy: { fullName: 'asc' },
      }),
      this.db.department.findMany({
        where: {
          tenantId,
          id: scopedDepartments,
          deletedAt: null,
          status: 'ACTIVE',
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.db.position.findMany({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const courses = new Map(
      releases.flatMap((release) =>
        release.courseId ? [[release.courseId, release] as const] : [],
      ),
    );
    const targets = releases.flatMap((release) => {
      const target: AssignmentTarget = release.courseId
        ? { id: release.courseId, kind: 'course' }
        : { id: release.programId!, kind: 'program' };
      return this.coursesForTarget(
        scope,
        target,
        courses,
        release.programId ? release : undefined,
      )
        ? [{ ...target, name: releaseName(release.content) }]
        : [];
    });
    return { targets, employees, departments, positions };
  }

  private enrollmentScope({
    tenantId,
    departmentIds,
  }: AssignmentContext): Prisma.EnrollmentWhereInput {
    return {
      tenantId,
      ...(departmentIds && {
        user: { departmentId: { in: departmentIds } },
        courseVersion: { departmentId: { in: departmentIds } },
      }),
    };
  }

  async list(actor: SessionIdentity, query: unknown) {
    const fields = object(query);
    const scope = this.enrollmentScope(this.scope(actor));
    const userId = fields.userId ? idInput(fields.userId) : undefined;
    const courseId = fields.courseId ? idInput(fields.courseId) : undefined;
    const status = fields.status as EnrollmentStatus | undefined;
    if (status && !statuses.includes(status))
      throw new BadRequestException('Trạng thái lượt học không hợp lệ.');
    const filter = { ...scope, userId, courseId };
    await this.db.enrollment.updateMany({
      where: {
        ...filter,
        status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
        dueAt: { lt: new Date() },
      },
      data: { status: 'OVERDUE' },
    });
    const rows = await this.db.enrollment.findMany({
      where: { ...filter, status: status || undefined },
      select: {
        id: true,
        courseId: true,
        userId: true,
        status: true,
        source: true,
        assignedAt: true,
        dueAt: true,
        completedAt: true,
        progressPercent: true,
        courseVersion: { select: { content: true, revision: true } },
        user: { select: { fullName: true } },
      },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(({ courseVersion, user, ...row }) => ({
      ...row,
      courseName: releaseName(courseVersion.content),
      courseRevision: courseVersion.revision,
      employeeName: user.fullName,
    }));
  }

  async manual(actor: SessionIdentity, body: unknown, ip?: string) {
    const data = manualInput(body);
    const scope = await this.lockScope(actor);
    const now = new Date();
    if (data.dueAt <= now)
      throw new BadRequestException('Hạn hoàn thành phải từ hôm nay trở đi.');
    const courses = await this.target(scope, data.target);
    if (!courses) throw missing();
    const { tenantId, departmentIds } = scope;
    if (data.departmentId) {
      const department = await this.db.department.findFirst({
        where: {
          id: data.departmentId,
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      if (!department || !allowed(scope, department.id)) throw missing();
    }
    const recipients = await this.db.user.findMany({
      where: {
        tenantId,
        ...eligibleEmployees,
        ...(data.departmentId
          ? { departmentId: data.departmentId }
          : {
              id: { in: data.userIds },
              departmentId: departmentIds ? { in: departmentIds } : undefined,
            }),
      },
      select: { id: true },
    });
    if (
      !recipients.length ||
      (!data.departmentId && recipients.length !== data.userIds.length)
    )
      throw missing();
    return this.assign(
      { tenantId, id: actor.id, ip },
      recipients.map(({ id }) => id),
      courses,
      {
        source: 'MANUAL',
        programId: data.target.kind === 'program' ? data.target.id : null,
        dueAt: data.dueAt,
        now,
      },
    );
  }

  async assign(
    actor: AssignmentActor,
    userIds: string[],
    courses: AssignedCourse[],
    options: {
      source: EnrollmentSource;
      programId: string | null;
      dueAt: Date;
      now: Date;
      ruleId?: string;
      previousEnrollmentId?: string;
    },
  ) {
    const { tenantId } = actor;
    if (!userIds.length || !courses.length) return { created: 0, extended: 0 };
    const existing = await this.db.enrollment.findMany({
      where: {
        tenantId,
        userId: { in: userIds },
        courseId: { in: courses.map(({ id }) => id) },
        ...(options.source === 'MANUAL' && { status: { in: activeStates } }),
      },
      select: {
        id: true,
        userId: true,
        courseId: true,
        status: true,
        dueAt: true,
        startedAt: true,
      },
      orderBy: { assignedAt: 'asc' },
    });
    const history = new Set<string>();
    const active = new Map<string, (typeof existing)[number]>();
    for (const row of existing) {
      const key = row.userId + '/' + row.courseId;
      history.add(key);
      if (activeStates.includes(row.status)) active.set(key, row);
    }

    const additions: Prisma.EnrollmentCreateManyInput[] = [];
    let extended = 0;
    for (const userId of userIds) {
      for (const course of courses) {
        const key = userId + '/' + course.id;
        const current = active.get(key);
        if (current) {
          if (options.previousEnrollmentId)
            throw new ConflictException(
              'Nhân viên đã có lượt học đang hiệu lực.',
            );
          if (options.dueAt > current.dueAt) {
            await this.extend(current, options.dueAt, options.now);
            extended++;
          }
        } else if (options.source === 'MANUAL' || !history.has(key)) {
          additions.push({
            tenantId,
            userId,
            courseId: course.id,
            courseVersionId: course.versionId,
            assignedById: actor.id,
            assignedAt: options.now,
            dueAt: options.dueAt,
            source: options.source,
            programId: options.programId,
            ruleId: options.ruleId,
            previousEnrollmentId: options.previousEnrollmentId,
          });
        }
      }
    }
    if (additions.length)
      await this.db.enrollment.createMany({ data: additions });
    return { created: additions.length, extended };
  }

  private async extend(
    current: {
      id: string;
      status: EnrollmentStatus;
      startedAt: Date | null;
      dueAt: Date;
    },
    dueAt: Date,
    now: Date,
  ) {
    if (dueAt <= now || dueAt <= current.dueAt)
      throw new BadRequestException(
        'Hạn mới phải sau hạn hiện tại và chưa quá hạn.',
      );
    const result = await this.db.enrollment.updateMany({
      where: { id: current.id, status: current.status, dueAt: current.dueAt },
      data: {
        dueAt,
        ...(current.status === 'OVERDUE' && {
          status: current.startedAt ? 'IN_PROGRESS' : 'NOT_STARTED',
        }),
      },
    });
    if (!result.count)
      throw new ConflictException('Lượt học đã thay đổi. Hãy tải lại.');
  }

  async change(
    actor: SessionIdentity,
    id: string,
    action: 'extend' | 'cancel' | 'reassign',
    body: unknown,
    ip?: string,
  ) {
    const scope = await this.lockScope(actor);
    const current = await this.db.enrollment.findFirst({
      where: { ...this.enrollmentScope(scope), id },
      include: { user: { select: { deletedAt: true, status: true } } },
    });
    if (!current) throw missing();
    const now = new Date();
    if (action === 'reassign') {
      if (
        !reassignable.includes(current.status) ||
        current.user.deletedAt ||
        !['ACTIVE', 'PENDING'].includes(current.user.status)
      )
        throw new ConflictException('Lượt học chưa thể được giao lại.');
      const dueAt = assignmentDeadline(object(body).dueDate);
      if (dueAt <= now)
        throw new BadRequestException('Hạn hoàn thành phải từ hôm nay trở đi.');
      const courses = await this.target(scope, {
        kind: 'course',
        id: current.courseId,
      });
      if (!courses) throw missing();
      return this.assign(
        { tenantId: scope.tenantId, id: actor.id, ip },
        [current.userId],
        courses,
        {
          source: 'MANUAL',
          programId: current.programId,
          previousEnrollmentId: current.id,
          dueAt,
          now,
        },
      );
    }
    if (!activeStates.includes(current.status))
      throw new ConflictException('Lượt học đã kết thúc.');
    if (action === 'extend') {
      await this.extend(current, assignmentDeadline(object(body).dueDate), now);
    } else {
      const result = await this.db.enrollment.updateMany({
        where: { id, status: current.status },
        data: { status: 'CANCELLED' },
      });
      if (!result.count)
        throw new ConflictException('Lượt học đã thay đổi. Hãy tải lại.');
    }
    return { id };
  }
}
