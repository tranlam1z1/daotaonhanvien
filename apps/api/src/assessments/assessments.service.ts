import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  can,
  permissionProfile,
  type SessionIdentity,
} from '../auth/permissions';
import { readConfig } from '../organization/organization-input';
import { TenantDatabase } from '../tenant/tenant-database';
import { questionGroup, questionInput, quizInput } from './assessment-input';

const permission = 'assessments.manage';

export function assessmentContext(actor: SessionIdentity) {
  const grants = permissionProfile(actor).filter(
    (grant) => grant.permission === permission,
  );
  if (!actor.tenantId || grants.length === 0) return null;
  return {
    tenantId: actor.tenantId,
    departmentIds: grants.some((grant) => grant.scope === 'tenant')
      ? undefined
      : [
          ...new Set(
            grants.flatMap((grant) =>
              grant.scope === 'departments' ? grant.departmentIds : [],
            ),
          ),
        ],
  };
}

function assessmentScope(actor: SessionIdentity) {
  const context = assessmentContext(actor);
  if (!context)
    throw new ForbiddenException('Bạn không có quyền quản lý kiểm tra.');
  return {
    tenantId: context.tenantId,
    departmentId: context.departmentIds
      ? { in: context.departmentIds }
      : undefined,
  };
}

const labels = { id: true, name: true } as const;
const questionFields = {
  id: true,
  departmentId: true,
  courseId: true,
  topic: true,
  type: true,
  prompt: true,
  options: true,
  correctOptions: true,
  explanation: true,
} satisfies Prisma.AssessmentQuestionSelect;
const quizFields = {
  id: true,
  departmentId: true,
  name: true,
  selectionMode: true,
  randomCount: true,
  timeLimitMinutes: true,
  passingScore: true,
  maxAttempts: true,
  shuffleQuestions: true,
  shuffleOptions: true,
  showAnswers: true,
  questions: {
    select: { questionId: true },
    orderBy: { position: 'asc' },
  },
} satisfies Prisma.QuizSelect;

@Injectable()
export class AssessmentsService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  private get db() {
    return this.database.client;
  }

  private async lockTenant(tenantId: string) {
    // Course publication takes the same lock while freezing quiz definitions.
    await this.db
      .$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
  }

  async catalog(actor: SessionIdentity) {
    const where = assessmentScope(actor);
    const [tenant, departments, courses, questions, quizzes] =
      await Promise.all([
        this.db.tenant.findUniqueOrThrow({
          where: { id: where.tenantId },
          select: { config: true },
        }),
        this.db.department.findMany({
          where: { tenantId: where.tenantId, id: where.departmentId },
          select: labels,
          orderBy: { name: 'asc' },
        }),
        this.db.trainingCourse.findMany({
          where,
          select: { ...labels, departmentId: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
        this.db.assessmentQuestion.findMany({
          where,
          select: questionFields,
          orderBy: [{ prompt: 'asc' }, { id: 'asc' }],
        }),
        this.db.quiz.findMany({
          where,
          select: quizFields,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
      ]);
    const { finalScorePercent, maxAttempts } = readConfig(
      tenant.config,
    ).completion;
    return {
      departments,
      courses,
      questions,
      quizzes,
      tenantWide: where.departmentId === undefined,
      defaults: { passingScore: finalScorePercent, maxAttempts },
    };
  }

  private async authorizeGroup(
    actor: SessionIdentity,
    departmentId: string | null,
  ) {
    const tenantId = actor.tenantId!;
    if (!can(actor, permission, { tenantId, departmentIds: [departmentId] })) {
      throw new ForbiddenException(
        'Bạn không có quyền quản lý kiểm tra trong phạm vi này.',
      );
    }
    if (
      departmentId &&
      !(await this.db.department.findUnique({
        where: { tenantId_id: { tenantId, id: departmentId } },
        select: { id: true },
      }))
    ) {
      throw new BadRequestException('Phòng ban không hợp lệ.');
    }
    return tenantId;
  }

  private async newQuestionGroup(actor: SessionIdentity, body: unknown) {
    const group = questionGroup(body);
    const tenantId = await this.authorizeGroup(actor, group.departmentId);
    if (
      group.courseId &&
      !(await this.db.trainingCourse.findFirst({
        where: {
          tenantId,
          id: group.courseId,
          departmentId: group.departmentId,
        },
        select: { id: true },
      }))
    ) {
      throw new BadRequestException('Khóa học không thuộc phạm vi đã chọn.');
    }
    return { tenantId, ...group };
  }

  async saveQuestion(actor: SessionIdentity, body: unknown, id?: string) {
    const input = questionInput(body);
    await this.lockTenant(actor.tenantId!);
    if (!id) {
      const group = await this.newQuestionGroup(actor, body);
      return this.db.assessmentQuestion.create({
        data: { ...group, ...input },
        select: questionFields,
      });
    }
    const current = await this.db.assessmentQuestion.findFirst({
      where: { ...assessmentScope(actor), id },
      select: { id: true },
    });
    if (!current) throw new NotFoundException('Không tìm thấy câu hỏi.');
    return this.db.assessmentQuestion.update({
      where: { tenantId_id: { tenantId: actor.tenantId!, id } },
      data: input,
      select: questionFields,
    });
  }

  async removeQuestion(actor: SessionIdentity, id: string) {
    const where = { ...assessmentScope(actor), id };
    await this.lockTenant(where.tenantId);
    try {
      const { count } = await this.db.assessmentQuestion.deleteMany({ where });
      if (count === 0) throw new NotFoundException('Không tìm thấy câu hỏi.');
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Câu hỏi đang được dùng trong bài kiểm tra.',
        );
      }
      throw error;
    }
  }

  async importQuestions(
    actor: SessionIdentity,
    body: unknown,
    rows: { row: number; fields: Record<string, unknown> }[],
  ) {
    const group = await this.newQuestionGroup(actor, body);
    const imported: ReturnType<typeof questionInput>[] = [];
    const errors: { row: number; message: string }[] = [];
    for (const { row, fields } of rows) {
      try {
        imported.push(questionInput(fields));
      } catch (error) {
        if (!(error instanceof BadRequestException)) throw error;
        errors.push({ row, message: error.message });
      }
    }
    if (errors.length)
      throw new BadRequestException({
        message: 'Sửa các dòng bị lỗi rồi nhập lại tệp.',
        errors,
      });
    return this.db.assessmentQuestion.createMany({
      data: imported.map((question) => ({ ...group, ...question })),
    });
  }

  async saveQuiz(actor: SessionIdentity, body: unknown, id?: string) {
    const { departmentId, questionIds, settings } = quizInput(body);
    const tenantId = await this.authorizeGroup(actor, departmentId);
    await this.lockTenant(tenantId);
    if (id) {
      const current = await this.db.quiz.findFirst({
        where: { ...assessmentScope(actor), id },
        select: { departmentId: true },
      });
      if (!current) throw new NotFoundException('Không tìm thấy bài kiểm tra.');
      if (current.departmentId !== departmentId)
        throw new BadRequestException(
          'Phạm vi của bài kiểm tra đã tạo không thể thay đổi.',
        );
    }
    const count = await this.db.assessmentQuestion.count({
      where: { tenantId, departmentId, id: { in: questionIds } },
    });
    if (count !== questionIds.length)
      throw new BadRequestException(
        'Câu hỏi phải thuộc phạm vi của bài kiểm tra.',
      );

    const selected = questionIds.map((questionId, position) => ({
      tenantId,
      questionId,
      position,
    }));
    try {
      if (!id) {
        return await this.db.quiz.create({
          data: {
            tenantId,
            departmentId,
            ...settings,
            questions: {
              createMany: {
                data: selected.map(({ questionId, position }) => ({
                  questionId,
                  position,
                })),
              },
            },
          },
          select: quizFields,
        });
      }
      await this.db.quiz.update({
        where: { tenantId_id: { tenantId, id } },
        data: settings,
      });
      await this.db.quizQuestion.deleteMany({
        where: { tenantId, quizId: id },
      });
      await this.db.quizQuestion.createMany({
        data: selected.map((question) => ({ ...question, quizId: id })),
      });
      return this.db.quiz.findUniqueOrThrow({
        where: { tenantId_id: { tenantId, id } },
        select: quizFields,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Danh sách câu hỏi đã thay đổi. Vui lòng tải lại.',
        );
      }
      throw error;
    }
  }
}
