import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Query,
  Req,
  StreamableFile,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { Workbook } from 'exceljs';
import { localDay } from '../assignments/assignment-input';
import type { SessionRequest } from '../auth/auth-http';
import { RequirePermission } from '../auth/authorization.guard';
import { permissionProfile } from '../auth/permissions';
import { dateInput } from '../employees/employee-input';
import { idInput } from '../knowledge/knowledge-input';
import { TenantDatabase } from '../tenant/tenant-database';
import { UseManualTenantTransaction } from '../tenant/tenant.interceptor';

const labels: Record<string, string> = {
  NOT_STARTED: 'Chưa học',
  IN_PROGRESS: 'Đang học',
  OVERDUE: 'Quá hạn',
  COMPLETED: 'Hoàn thành',
  FAILED: 'Chưa đạt',
  CANCELLED: 'Đã hủy',
};
const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function aggregate<T>(
  rows: T[],
  key: (row: T) => { id: string; name: string },
  status: (row: T) => string,
) {
  const groups = new Map<
    string,
    { id: string; name: string; totals: Record<string, number> }
  >();
  for (const row of rows) {
    const { id, name } = key(row);
    const group = groups.get(id) ?? { id, name, totals: {} };
    const value = status(row);
    group.totals[value] = (group.totals[value] ?? 0) + 1;
    groups.set(id, group);
  }
  return [...groups.values()];
}

@Controller('reports')
export class ReportsController {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  @Get()
  @RequirePermission('session.profile')
  async report(
    @Req() request: SessionRequest,
    @Query() query: Record<string, string>,
  ) {
    const actor = request.user!;
    const tenantId = actor.tenantId;
    const grants = permissionProfile(actor).filter(
      (grant) =>
        grant.permission === 'training.report' && grant.scope !== 'self',
    );
    if (!tenantId || !grants.length)
      throw new ForbiddenException('Bạn không có quyền xem báo cáo.');
    const tenantWide = grants.some(({ scope }) => scope === 'tenant');
    const departments = grants.flatMap((grant) =>
      grant.scope === 'departments' ? grant.departmentIds : [],
    );
    const scope: Prisma.UserWhereInput[] = [
      ...(departments.length ? [{ departmentId: { in: departments } }] : []),
      ...(grants.some(({ scope }) => scope === 'directReports')
        ? [{ managerId: actor.id }]
        : []),
    ];
    const filterId = (key: string) =>
      query[key] ? idInput(query[key]) : undefined;
    const employee = {
      departmentId: filterId('departmentId'),
      ...(tenantWide ? {} : { OR: scope }),
    };
    const vietnamOffset = 7 * 60 * 60 * 1000;
    const from = query.from ? dateInput(query.from, 'Ngày bắt đầu') : null;
    const until = query.to ? dateInput(query.to, 'Ngày kết thúc') : null;
    if (from && until && from > until)
      throw new BadRequestException(
        'Ngày kết thúc phải từ ngày bắt đầu trở đi.',
      );
    const assignedAt = {
      gte: from ? new Date(+from - vietnamOffset) : undefined,
      lt: until ? new Date(+until + 86_400_000 - vietnamOffset) : undefined,
    };
    const db = this.database.client;
    const now = new Date();
    const availableEmployees = await db.user.findMany({
      where: { tenantId, ...(tenantWide ? {} : { OR: scope }) },
      select: {
        id: true,
        fullName: true,
        department: { select: { id: true, name: true } },
        enrollments: {
          select: {
            course: { select: { id: true, name: true } },
            program: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });
    const choices = (entries: ({ id: string; name: string } | null)[]) =>
      [
        ...new Map(
          entries.flatMap((entry) =>
            entry ? [[entry.id, entry] as const] : [],
          ),
        ).values(),
      ].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    const [
      enrollments,
      handovers,
      pendingKnowledge,
      pendingCourses,
      pendingPrograms,
    ] = await Promise.all([
      db.enrollment.findMany({
        where: {
          tenantId,
          assignedAt,
          courseId: filterId('courseId'),
          programId: filterId('programId'),
          userId: filterId('employeeId'),
          user: employee,
        },
        select: {
          id: true,
          status: true,
          progressPercent: true,
          assignedAt: true,
          dueAt: true,
          completedAt: true,
          userId: true,
          courseId: true,
          programId: true,
          user: {
            select: {
              fullName: true,
              department: { select: { id: true, name: true } },
            },
          },
          course: { select: { name: true } },
          program: { select: { name: true } },
          quizAttempts: {
            where: { submittedAt: { not: null } },
            select: {
              score: true,
              passed: true,
              questions: true,
              answers: true,
            },
          },
          survey: { select: { ratings: true, feedback: true } },
        },
        orderBy: { assignedAt: 'desc' },
      }),
      db.handoverCase.findMany({
        where: {
          tenantId,
          createdAt: assignedAt,
          employeeId: filterId('employeeId'),
          employee,
        },
        select: {
          id: true,
          dueOn: true,
          completedAt: true,
          employee: { select: { fullName: true } },
        },
      }),
      tenantWide || departments.length
        ? db.knowledgeVersion.count({
            where: {
              tenantId,
              status: 'IN_REVIEW',
              ...(tenantWide
                ? {}
                : {
                    audience: 'DEPARTMENTS' as const,
                    departmentIds: { hasSome: departments },
                  }),
            },
          })
        : 0,
      tenantWide || departments.length
        ? db.trainingCourse.count({
            where: {
              tenantId,
              status: 'IN_REVIEW',
              ...(tenantWide ? {} : { departmentId: { in: departments } }),
            },
          })
        : 0,
      tenantWide || departments.length
        ? db.trainingProgram.count({
            where: {
              tenantId,
              status: 'IN_REVIEW',
              ...(tenantWide ? {} : { departmentId: { in: departments } }),
            },
          })
        : 0,
    ]);
    const rows = enrollments.map((row) => ({
      id: row.id,
      userId: row.userId,
      courseId: row.courseId,
      programId: row.programId,
      user: row.user,
      course: row.course,
      program: row.program,
      assignedAt: row.assignedAt,
      dueAt: row.dueAt,
      completedLate: !!row.completedAt && row.completedAt > row.dueAt,
      progressPercent: row.progressPercent,
      status:
        (row.status === 'IN_PROGRESS' || row.status === 'NOT_STARTED') &&
        row.dueAt < now
          ? 'OVERDUE'
          : row.status,
    }));
    const cases = handovers.map((record) => ({
      ...record,
      status: record.completedAt
        ? 'Hoàn tất'
        : localDay(record.dueOn) < localDay(now)
          ? 'Quá hạn'
          : 'Đang mở',
    }));
    const questions = new Map<string, { answered: number; wrong: number }>();
    const quizzes = enrollments
      .flatMap(({ quizAttempts }) => quizAttempts)
      .filter(({ score }) => score !== null);
    for (const quiz of quizzes) {
      if (
        !Array.isArray(quiz.questions) ||
        !quiz.answers ||
        Array.isArray(quiz.answers) ||
        typeof quiz.answers !== 'object'
      )
        continue;
      for (const [index, item] of quiz.questions.entries()) {
        if (
          !item ||
          typeof item !== 'object' ||
          Array.isArray(item) ||
          typeof item.prompt !== 'string' ||
          !Array.isArray(item.correctOptions)
        )
          continue;
        const result = questions.get(item.prompt) ?? { answered: 0, wrong: 0 };
        result.answered++;
        const answer = quiz.answers[String(index)];
        if (
          !Array.isArray(answer) ||
          answer.length !== item.correctOptions.length ||
          item.correctOptions.some((option) => !answer.includes(option))
        )
          result.wrong++;
        questions.set(item.prompt, result);
      }
    }
    const surveys = enrollments.flatMap(({ course, survey }) =>
      survey ? [{ course: course.name, ...survey }] : [],
    );
    const completed = rows.filter(
      ({ status }) => status === 'COMPLETED',
    ).length;
    const eligible = rows.filter(({ status }) => status !== 'CANCELLED').length;
    return {
      rows,
      cases,
      surveys,
      filters: {
        employees: availableEmployees.map(({ id, fullName }) => ({
          id,
          name: fullName,
        })),
        departments: choices(
          availableEmployees.map(({ department }) => department),
        ),
        courses: choices(
          availableEmployees.flatMap(({ enrollments }) =>
            enrollments.map(({ course }) => course),
          ),
        ),
        programs: choices(
          availableEmployees.flatMap(({ enrollments }) =>
            enrollments.map(({ program }) => program),
          ),
        ),
      },
      summary: {
        activeLearners: new Set(
          rows
            .filter(({ status }) => status === 'IN_PROGRESS')
            .map(({ userId }) => userId),
        ).size,
        completionRate: eligible ? Math.round((completed * 100) / eligible) : 0,
        overdue: rows.filter(({ status }) => status === 'OVERDUE').length,
        pending: pendingKnowledge + pendingCourses + pendingPrograms,
        openHandovers: cases.filter(({ completedAt }) => !completedAt).length,
      },
      groups: {
        courses: aggregate(
          rows,
          ({ course, courseId }) => ({ id: courseId, name: course.name }),
          ({ status }) => status,
        ),
        programs: aggregate(
          rows,
          ({ program, programId }) => ({
            id: programId ?? '',
            name: program?.name ?? 'Không thuộc chương trình',
          }),
          ({ status }) => status,
        ),
        departments: aggregate(
          rows,
          ({ user }) =>
            user.department ?? { id: '', name: 'Chưa có phòng ban' },
          ({ status }) => status,
        ),
        employees: aggregate(
          rows,
          ({ user, userId }) => ({ id: userId, name: user.fullName }),
          ({ status }) => status,
        ),
      },
      quiz: {
        attempts: quizzes.length,
        average: quizzes.length
          ? Math.round(
              quizzes.reduce((sum, attempt) => sum + (attempt.score ?? 0), 0) /
                quizzes.length,
            )
          : 0,
        passRate: quizzes.length
          ? Math.round(
              (quizzes.filter(({ passed }) => passed).length * 100) /
                quizzes.length,
            )
          : 0,
        questions: [...questions]
          .map(([prompt, result]) => ({
            prompt,
            wrongRate: Math.round((result.wrong * 100) / result.answered),
          }))
          .sort((a, b) => b.wrongRate - a.wrongRate),
      },
    };
  }

  @Get('export')
  @RequirePermission('session.profile')
  @UseManualTenantTransaction()
  async export(
    @Req() request: SessionRequest,
    @Query() query: Record<string, string>,
  ) {
    const result = await this.database.run(request.user!.tenantId, () =>
      this.report(request, query),
    );
    const workbook = new Workbook();
    const progress = workbook.addWorksheet('Tiến độ');
    progress.addRow([
      'Nhân viên',
      'Phòng ban',
      'Khóa học',
      'Chương trình',
      'Trạng thái',
      'Tiến độ (%)',
      'Ngày giao',
      'Hạn',
      'Hoàn thành trễ',
    ]);
    for (const row of result.rows)
      progress.addRow([
        row.user.fullName,
        row.user.department?.name ?? '',
        row.course.name,
        row.program?.name ?? '',
        labels[row.status],
        row.progressPercent,
        dateFormat.format(row.assignedAt),
        dateFormat.format(row.dueAt),
        row.completedLate ? 'Có' : 'Không',
      ]);
    const handover = workbook.addWorksheet('Bàn giao');
    handover.addRow(['Nhân viên', 'Hạn bàn giao', 'Trạng thái']);
    for (const entry of result.cases)
      handover.addRow([
        entry.employee.fullName,
        dateFormat.format(entry.dueOn),
        entry.status,
      ]);
    const quiz = workbook.addWorksheet('Kiểm tra');
    quiz.addRow(['Lượt làm', 'Điểm trung bình', 'Tỷ lệ đạt (%)']);
    quiz.addRow([
      result.quiz.attempts,
      result.quiz.average,
      result.quiz.passRate,
    ]);
    quiz.addRow(['Câu hỏi', 'Tỷ lệ sai (%)']);
    for (const entry of result.quiz.questions)
      quiz.addRow([entry.prompt, entry.wrongRate]);
    const surveys = workbook.addWorksheet('Khảo sát');
    surveys.addRow(['Khóa học', 'Điểm đánh giá', 'Góp ý']);
    for (const entry of result.surveys)
      surveys.addRow([
        entry.course,
        JSON.stringify(entry.ratings),
        entry.feedback,
      ]);
    return new StreamableFile(Buffer.from(await workbook.xlsx.writeBuffer()), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="bao-cao-dao-tao.xlsx"',
    });
  }
}
