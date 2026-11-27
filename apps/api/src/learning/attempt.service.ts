import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { QuizAttempt } from '@prisma/client';
import type { SessionIdentity } from '../auth/permissions';
import { idInput, object } from '../knowledge/knowledge-input';
import { TenantDatabase } from '../tenant/tenant-database';
import { isActive, quizLimits } from './completion.service';
import { LearningService } from './learning.service';
import {
  createPaper,
  grade,
  readAnswers,
  type QuizAnswers,
  type QuizQuestion,
} from './quiz-policy';

export type AttemptAction = 'load' | 'start' | 'save' | 'submit' | 'review';
type LessonState = Awaited<ReturnType<LearningService['lesson']>>;

function activePaper(attempt: QuizAttempt) {
  return attempt.questions as QuizQuestion[];
}

function present(attempt: QuizAttempt) {
  return {
    id: attempt.id,
    number: attempt.number,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt,
    score: attempt.score,
    passed: attempt.passed,
    answers: attempt.answers as QuizAnswers,
    questions: activePaper(attempt).map(
      ({ correctOptions, explanation, ...question }) => ({
        ...question,
        ...(attempt.submittedAt && attempt.showAnswers
          ? { correctOptions, explanation }
          : {}),
      }),
    ),
  };
}

@Injectable()
export class AttemptService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AttemptService.name);
  private timer?: ReturnType<typeof setInterval>;
  private tick?: Promise<void>;

  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(LearningService) private readonly learning: LearningService,
  ) {}

  private get db() {
    return this.database.client;
  }

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    const poll = () => {
      if (this.tick) return;
      this.tick = this.expireDue()
        .catch(() => {
          this.logger.warn(
            'Could not finalize expired quiz attempts. Will retry.',
          );
        })
        .finally(() => {
          this.tick = undefined;
        });
    };
    this.timer = setInterval(poll, 15_000);
    this.timer.unref();
    poll();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.tick;
  }

  async act(
    actor: SessionIdentity,
    id: string,
    lessonId: string,
    action: AttemptAction,
    payload: unknown,
  ) {
    const state = await this.learning.lesson(actor, id, lessonId, true);
    const { enrollment, lesson, content } = state;
    if (lesson.type !== 'QUIZ' || !lesson.quizId)
      throw new NotFoundException('Không tìm thấy bài kiểm tra.');
    const definition = content.quizDefinitions?.[lesson.quizId];
    if (!definition)
      throw new ConflictException(
        'Bài kiểm tra cần được cấu hình và xuất bản trong khóa học.',
      );
    const { passingScore, maxAttempts } = quizLimits(
      content,
      lessonId,
      definition,
    );
    const where = { tenantId: enrollment.tenantId, enrollmentId: id, lessonId };
    const now = new Date();
    const attempts = await this.db.quizAttempt.findMany({
      where,
      orderBy: { number: 'desc' },
      select: {
        id: true,
        number: true,
        passed: true,
        score: true,
        submittedAt: true,
      },
    });
    let latest =
      attempts[0] &&
      (await this.db.quizAttempt.findUniqueOrThrow({
        where: { id: attempts[0].id },
      }));
    const body = object(payload ?? {});
    if (action === 'review') {
      const attempt = await this.db.quizAttempt.findFirst({
        where: {
          ...where,
          id: idInput(body.attemptId),
          submittedAt: { not: null },
        },
      });
      if (!attempt)
        throw new NotFoundException('Không tìm thấy lần làm đã nộp.');
      return present(attempt);
    }
    if (
      (action === 'save' || action === 'submit') &&
      idInput(body.attemptId) !== latest?.id
    )
      throw new ConflictException(
        'Lần làm đã thay đổi. Hãy mở lại bài kiểm tra.',
      );
    let status = enrollment.status;
    if (
      latest &&
      !latest.submittedAt &&
      (latest.expiresAt <= now || action === 'submit')
    ) {
      const result = await this.finish(latest, state, now);
      latest = result.attempt;
      status = result.status;
    }
    const canStart = () =>
      isActive(status) &&
      !state.progress.get(lessonId)?.completedAt &&
      !latest?.passed &&
      (latest?.number ?? 0) < maxAttempts &&
      (!latest || latest.submittedAt !== null);
    if (action === 'start' && canStart()) {
      latest = await this.db.quizAttempt.create({
        data: {
          ...where,
          number: (latest?.number ?? 0) + 1,
          questions: createPaper(definition),
          passingScore,
          showAnswers: definition.showAnswers,
          startedAt: now,
          expiresAt: new Date(
            now.getTime() + definition.timeLimitMinutes * 60_000,
          ),
        },
      });
      if (enrollment.status === 'NOT_STARTED' || !enrollment.startedAt) {
        status = enrollment.dueAt < now ? 'OVERDUE' : 'IN_PROGRESS';
        await this.db.enrollment.update({
          where: { id },
          data: { status, startedAt: enrollment.startedAt ?? now },
        });
      }
    }
    if (action === 'save' && latest && !latest.submittedAt) {
      latest = await this.db.quizAttempt.update({
        where: { id: latest.id },
        data: {
          answers: {
            ...object(latest.answers),
            ...readAnswers(body.answers, activePaper(latest)),
          } as QuizAnswers,
        },
      });
    }
    const history = latest
      ? [
          latest,
          ...attempts.filter(({ id: attemptId }) => attemptId !== latest!.id),
        ]
      : [];
    return {
      status,
      canStart: canStart(),
      maxAttempts,
      passingScore,
      durationMinutes: definition.timeLimitMinutes,
      serverNow: now,
      attempt: latest ? present(latest) : null,
      history: history.map(
        ({ id: attemptId, number, score, passed, submittedAt }) => ({
          id: attemptId,
          number,
          score,
          passed,
          submittedAt,
        }),
      ),
    };
  }

  private async finish(
    current: QuizAttempt,
    state: LessonState | null,
    now: Date,
  ) {
    const score = grade(activePaper(current), current.answers as QuizAnswers);
    const passed = score >= current.passingScore;
    const submittedAt = current.expiresAt <= now ? current.expiresAt : now;
    const attempt = await this.db.quizAttempt.update({
      where: { id: current.id },
      data: { score, passed, submittedAt },
    });
    let status = state?.enrollment.status ?? 'CANCELLED';
    if (!state || !isActive(status)) return { attempt, status };
    if (passed) {
      const result = await this.learning.record(
        state,
        {
          completedAt: submittedAt,
          quizScore: score,
        },
        submittedAt,
      );
      return { attempt, status: result.status };
    }
    const { enrollment, lesson, content } = state;
    const key = {
      tenantId: enrollment.tenantId,
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
    };
    const best = Math.max(score, state.progress.get(lesson.id)?.quizScore ?? 0);
    await this.db.lessonProgress.upsert({
      where: { tenantId_enrollmentId_lessonId: key },
      create: { ...key, quizScore: best },
      update: { quizScore: best },
    });
    const definition =
      lesson.quizId && content.quizDefinitions?.[lesson.quizId];
    if (
      definition &&
      current.number >= quizLimits(content, lesson.id, definition).maxAttempts
    ) {
      await this.db.enrollment.update({
        where: { id: enrollment.id },
        data: { status: 'FAILED' },
      });
      status = 'FAILED';
    }
    return { attempt, status };
  }

  async expireDue() {
    const tenants = await this.database.runPlatform(null, () =>
      this.db.tenant.findMany({
        where: { deletedAt: null },
        select: { id: true },
      }),
    );
    const now = new Date();
    for (const { id: tenantId } of tenants) {
      const due = await this.database.run(tenantId, () =>
        this.db.quizAttempt.findMany({
          where: { tenantId, submittedAt: null, expiresAt: { lte: now } },
          select: { id: true, enrollmentId: true, lessonId: true },
          orderBy: { expiresAt: 'asc' },
          take: 100,
        }),
      );
      for (const candidate of due) {
        await this.database.run(tenantId, async () => {
          const [enrollment] = await this.db.$queryRaw<
            { user_id: string; status: string }[]
          >`
            SELECT user_id, status FROM enrollments
            WHERE tenant_id = ${tenantId}::uuid AND id = ${candidate.enrollmentId}::uuid
            FOR UPDATE
          `;
          if (!enrollment) return;
          const current = await this.db.quizAttempt.findUnique({
            where: { id: candidate.id },
          });
          if (!current || current.submittedAt) return;
          const state =
            enrollment.status === 'CANCELLED'
              ? null
              : await this.learning.lesson(
                  { tenantId, id: enrollment.user_id },
                  candidate.enrollmentId,
                  candidate.lessonId,
                );
          await this.finish(current, state, now);
        });
      }
    }
  }
}
