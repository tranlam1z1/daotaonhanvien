import { Inject, Injectable } from '@nestjs/common';
import type { Enrollment } from '@prisma/client';
import { defaultCourseCompletion } from '../training-policy/course-completion';
import type { TrainingApprovalService } from '../training/training-approval.service';
import { TenantDatabase } from '../tenant/tenant-database';
import { activeEnrollmentStatuses } from './learning-policy';
import type { QuizDefinition } from './quiz-policy';

export type AssignedContent = Awaited<
  ReturnType<TrainingApprovalService['assignedCourseVersion']>
>['content'];

export function isActive(status: Enrollment['status']) {
  return activeEnrollmentStatuses.some((candidate) => candidate === status);
}

export function courseCriteria(content: AssignedContent) {
  return content.completion ?? defaultCourseCompletion(null).completion;
}

export function finalQuizLesson(content: AssignedContent) {
  return content.modules
    .flatMap(({ lessons }) => lessons)
    .filter(({ type, quizId }) => type === 'QUIZ' && !!quizId)
    .at(-1);
}

export function quizLimits(
  content: AssignedContent,
  lessonId: string,
  definition: QuizDefinition,
) {
  const rules = courseCriteria(content);
  const final = finalQuizLesson(content)?.id === lessonId;
  return {
    passingScore:
      final && rules.finalScoreRequired
        ? Math.max(rules.finalScorePercent, definition.passingScore)
        : definition.passingScore,
    maxAttempts:
      final && rules.attemptLimitEnabled
        ? Math.min(rules.maxAttempts, definition.maxAttempts)
        : definition.maxAttempts,
  };
}

@Injectable()
export class CompletionService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  /** The caller holds the enrollment row lock until all outcome writes commit. */
  async evaluate(enrollment: Enrollment, content: AssignedContent, now: Date) {
    if (!isActive(enrollment.status)) return enrollment.status;
    const rules = courseCriteria(content);
    const { id, tenantId } = enrollment;
    const db = this.database.client;
    if (
      rules.lessonRequired &&
      enrollment.progressPercent < rules.lessonPercent
    )
      return enrollment.status;
    if (rules.finalScoreRequired) {
      const final = finalQuizLesson(content);
      const result =
        final &&
        (await db.lessonProgress.findUnique({
          where: {
            tenantId_enrollmentId_lessonId: {
              tenantId,
              enrollmentId: id,
              lessonId: final.id,
            },
          },
          select: { completedAt: true, quizScore: true },
        }));
      if (
        !result ||
        !result.completedAt ||
        result.quizScore === null ||
        result.quizScore < rules.finalScorePercent
      )
        return enrollment.status;
    }
    if (rules.practiceRequired) {
      const practice = await db.practiceResult.findUnique({
        where: { tenantId_enrollmentId: { tenantId, enrollmentId: id } },
        select: { passed: true },
      });
      if (!practice?.passed) return enrollment.status;
    }
    await db.enrollment.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: now },
    });
    return 'COMPLETED';
  }
}
