import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AssignmentRule, Prisma } from '@prisma/client';
import type { SessionIdentity } from '../auth/permissions';
import { object } from '../knowledge/knowledge-input';
import { TenantDatabase } from '../tenant/tenant-database';
import { dayMs, localDay, ruleInput } from './assignment-input';
import {
  AssignmentsService,
  eligibleEmployees,
  type AssignmentActor,
  type AssignmentContext,
} from './assignments.service';

const ruleEmployee = {
  id: true,
  departmentId: true,
  positionId: true,
  joinedAt: true,
} satisfies Prisma.UserSelect;
type RuleEmployee = Prisma.UserGetPayload<{ select: typeof ruleEmployee }>;

function missingRule() {
  return new NotFoundException(
    'Không tìm thấy quy tắc hoặc nội dung trong phạm vi phân bổ.',
  );
}

function targetOf(rule: AssignmentRule) {
  return rule.programId
    ? { kind: 'program' as const, id: rule.programId }
    : { kind: 'course' as const, id: rule.courseId! };
}

function presentRule(rule: AssignmentRule) {
  const { id, name, departmentId, positionId, newHireDays, dueDays, enabled } =
    rule;
  return {
    id,
    name,
    departmentId,
    positionId,
    newHireDays,
    dueDays,
    enabled,
    target: targetOf(rule),
  };
}

function matches(rule: AssignmentRule, employee: RuleEmployee, now: Date) {
  if (rule.departmentId && employee.departmentId !== rule.departmentId)
    return false;
  if (rule.positionId && employee.positionId !== rule.positionId) return false;
  if (rule.newHireDays === null) return true;
  if (!employee.joinedAt) return false;
  // Prisma @db.Date returns the calendar day at UTC midnight.
  const elapsed =
    localDay(now) - Math.floor(employee.joinedAt.valueOf() / dayMs);
  return elapsed >= 0 && elapsed <= rule.newHireDays;
}

@Injectable()
export class AssignmentRulesService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(AssignmentsService)
    private readonly assignments: AssignmentsService,
  ) {}

  private get db() {
    return this.database.client;
  }

  async list(actor: SessionIdentity) {
    const scope = this.assignments.scope(actor);
    const { tenantId, departmentIds } = scope;
    const rules = await this.db.assignmentRule.findMany({
      where: {
        tenantId,
        ...(departmentIds && {
          departmentId: { in: departmentIds },
          scopeDepartmentIds: { isEmpty: false },
        }),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rules.filter((rule) => this.inScope(scope, rule)).map(presentRule);
  }

  private inScope(scope: AssignmentContext, rule: AssignmentRule) {
    return (
      !scope.departmentIds ||
      (!!rule.departmentId &&
        scope.departmentIds.includes(rule.departmentId) &&
        rule.scopeDepartmentIds.length > 0 &&
        rule.scopeDepartmentIds.every((id) =>
          scope.departmentIds!.includes(id),
        ))
    );
  }

  async save(actor: SessionIdentity, body: unknown, id?: string, ip?: string) {
    const data = ruleInput(body);
    const enabled = object(body).enabled ?? true;
    if (typeof enabled !== 'boolean')
      throw new BadRequestException('Trạng thái quy tắc không hợp lệ.');
    const scope = await this.assignments.lockScope(actor);
    const { tenantId, departmentIds } = scope;
    if (
      departmentIds &&
      (!data.departmentId || !departmentIds.includes(data.departmentId))
    )
      throw missingRule();
    const current = id
      ? await this.db.assignmentRule.findFirst({ where: { id, tenantId } })
      : null;
    if (id && (!current || !this.inScope(scope, current))) throw missingRule();

    const [courses, department, position] = await Promise.all([
      this.assignments.target(scope, data.target),
      data.departmentId
        ? this.db.department.findFirst({
            where: {
              tenantId,
              id: data.departmentId,
              deletedAt: null,
              status: 'ACTIVE',
            },
            select: { id: true },
          })
        : null,
      data.positionId
        ? this.db.position.findFirst({
            where: {
              tenantId,
              id: data.positionId,
              deletedAt: null,
              status: 'ACTIVE',
            },
            select: { id: true },
          })
        : null,
    ]);
    if (
      !courses ||
      (data.departmentId && !department) ||
      (data.positionId && !position)
    )
      throw missingRule();

    const fields = {
      name: data.name,
      departmentId: data.departmentId,
      positionId: data.positionId,
      newHireDays: data.newHireDays,
      dueDays: data.dueDays,
      enabled,
      courseId: data.target.kind === 'course' ? data.target.id : null,
      programId: data.target.kind === 'program' ? data.target.id : null,
      scopeDepartmentIds: departmentIds || [],
    };
    const rule = current
      ? await this.db.assignmentRule.update({
          where: { id: current.id },
          data: fields,
        })
      : await this.db.assignmentRule.create({ data: { ...fields, tenantId } });
    let applied = { created: 0, extended: 0 };
    if (data.applyExisting && enabled) {
      const now = new Date();
      const employees = await this.db.user.findMany({
        where: {
          tenantId,
          ...eligibleEmployees,
          departmentId: rule.departmentId ?? undefined,
          positionId: rule.positionId ?? undefined,
        },
        select: ruleEmployee,
      });
      const employeeIds = employees
        .filter((employee) => matches(rule, employee, now))
        .map(({ id }) => id);
      applied = await this.assignments.assign(
        { tenantId, id: actor.id, ip },
        employeeIds,
        courses,
        {
          source: 'AUTOMATIC',
          dueAt: new Date(now.valueOf() + rule.dueDays * dayMs),
          now,
          programId: rule.programId,
          ruleId: rule.id,
        },
      );
    }
    return { rule: presentRule(rule), applied };
  }

  /** Employee create, import and transfers already hold the tenant row lock. */
  async employeesChanged(actor: AssignmentActor, userIds: string[]) {
    if (!userIds.length) return;
    const { tenantId } = actor;
    const rules = await this.db.assignmentRule.findMany({
      where: { tenantId, enabled: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    if (!rules.length) return;

    const employees = await this.db.user.findMany({
      where: { tenantId, id: { in: userIds }, ...eligibleEmployees },
      select: ruleEmployee,
    });
    const now = new Date();
    for (const rule of rules) {
      const eligible = employees.filter((employee) =>
        matches(rule, employee, now),
      );
      if (!eligible.length) continue;
      const courses = await this.assignments.target(
        {
          tenantId,
          departmentIds: rule.scopeDepartmentIds.length
            ? rule.scopeDepartmentIds
            : undefined,
        },
        targetOf(rule),
      );
      // A program may later release a course outside the original rule's scope.
      // Keep the rule and employee update intact until an authorized editor adjusts it.
      if (!courses) continue;
      await this.assignments.assign(
        actor,
        eligible.map(({ id }) => id),
        courses,
        {
          source: 'AUTOMATIC',
          dueAt: new Date(now.valueOf() + rule.dueDays * dayMs),
          now,
          programId: rule.programId,
          ruleId: rule.id,
        },
      );
    }
  }
}
