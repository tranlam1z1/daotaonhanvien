import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Enrollment, LessonProgress } from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';
import type { SessionIdentity } from '../auth/permissions';
import { FilesService } from '../files/files.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { TenantDatabase } from '../tenant/tenant-database';
import { TrainingApprovalService } from '../training/training-approval.service';
import {
  CompletionService,
  finalQuizLesson,
  isActive,
  quizLimits,
  type AssignedContent,
} from './completion.service';
import {
  learningPolicy,
  mergePlayback,
  playbackInput,
  unchangedLesson,
  type VideoSegment,
} from './learning-policy';

function learnerStatus(enrollment: Enrollment, now: Date) {
  return isActive(enrollment.status) && enrollment.dueAt < now
    ? 'OVERDUE'
    : enrollment.status;
}

function percent(completed: number, total: number) {
  return total ? Math.floor((100 * completed) / total) : 0;
}

function missingEnrollment() {
  return new NotFoundException('Không tìm thấy lượt học.');
}

type Version = Awaited<
  ReturnType<TrainingApprovalService['assignedCourseVersion']>
>;
type Learner = Pick<SessionIdentity, 'id' | 'tenantId'>;

@Injectable()
export class LearningService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(TrainingApprovalService)
    private readonly training: TrainingApprovalService,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(CompletionService) private readonly completion: CompletionService,
  ) {}

  private get db() {
    return this.database.client;
  }

  async list(actor: SessionIdentity) {
    const now = new Date();
    const enrollments = await this.db.enrollment.findMany({
      where: {
        tenantId: actor.tenantId!,
        userId: actor.id,
        status: { not: 'CANCELLED' },
      },
      include: {
        courseVersion: { select: { content: true } },
        lessons: {
          where: { quizScore: { not: null } },
          select: { lessonId: true, quizScore: true },
        },
      },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
    });
    return Promise.all(
      enrollments.map(async (enrollment) => {
        const version = enrollment.courseVersion.content as Version['content'];
        const inherited = await this.inheritedProgress(enrollment, version);
        const finalQuiz = finalQuizLesson(version);
        return {
          id: enrollment.id,
          title: version.name,
          status: learnerStatus(enrollment, now),
          dueAt: enrollment.dueAt,
          completedAt: enrollment.completedAt,
          score:
            [...enrollment.lessons, ...inherited].find(
              ({ lessonId }) => lessonId === finalQuiz?.id,
            )?.quizScore ?? null,
          completedLate:
            !!enrollment.completedAt &&
            enrollment.completedAt > enrollment.dueAt,
          progressPercent: inherited.length
            ? percent(
                inherited.filter((row) => row.completedAt).length,
                version.modules.flatMap((module) => module.lessons).length,
              )
            : enrollment.progressPercent,
        };
      }),
    );
  }

  async detail(actor: SessionIdentity, id: string) {
    const { enrollment, content, progress } = await this.course(actor, id);
    let locked = false;
    const modules = content.modules.map((module) => ({
      id: module.id,
      title: module.name,
      lessons: module.lessons.map((lesson) => {
        const completed = !!progress.get(lesson.id)?.completedAt;
        const result = {
          id: lesson.id,
          title: lesson.name,
          type: lesson.type,
          durationMinutes: lesson.durationMinutes,
          completed,
          locked,
        };
        if (content.learningMode === 'SEQUENTIAL' && !completed) locked = true;
        return result;
      }),
    }));
    const available = modules
      .flatMap((module) => module.lessons)
      .filter((lesson) => !lesson.locked && !lesson.completed);
    available.sort(
      (a, b) =>
        (progress.get(b.id)?.updatedAt.getTime() ?? 0) -
        (progress.get(a.id)?.updatedAt.getTime() ?? 0),
    );
    return {
      id,
      title: content.name,
      description: content.description,
      status: learnerStatus(enrollment, new Date()),
      dueAt: enrollment.dueAt,
      modules,
      resumeLessonId:
        isActive(enrollment.status) && enrollment.startedAt
          ? (available[0]?.id ?? null)
          : null,
    };
  }

  async open(actor: SessionIdentity, id: string, lessonId: string) {
    const state = await this.lesson(actor, id, lessonId, true);
    let enrollment: Enrollment = state.enrollment;
    const { lesson, progress, content } = state;
    const now = new Date();
    const status = learnerStatus(enrollment, now);
    if (
      isActive(status) &&
      (!enrollment.startedAt || status !== enrollment.status)
    ) {
      enrollment = await this.db.enrollment.update({
        where: { id },
        data: {
          startedAt: enrollment.startedAt ?? now,
          status: status === 'NOT_STARTED' ? 'IN_PROGRESS' : status,
        },
      });
    }
    if (isActive(status) && !progress.get(lessonId)?.completedAt) {
      const key = { tenantId: enrollment.tenantId, enrollmentId: id, lessonId };
      await this.db.lessonProgress.upsert({
        where: { tenantId_enrollmentId_lessonId: key },
        create: key,
        update: { updatedAt: now },
      });
    }
    const resultStatus = await this.completion.evaluate(
      enrollment,
      content,
      now,
    );
    return {
      id: lesson.id,
      title: lesson.name,
      type: lesson.type,
      body: lesson.body,
      videoUrl: lesson.videoUrl,
      file: lesson.fileId
        ? await this.db.fileObject.findUnique({
            where: {
              tenantId_id: { tenantId: enrollment.tenantId, id: lesson.fileId },
            },
            select: { name: true, contentType: true },
          })
        : null,
      knowledge: lesson.knowledgeId
        ? await this.knowledge.reader(actor, lesson.knowledgeId).then(
            (article) => ({ id: lesson.knowledgeId, title: article.title }),
            (error: unknown) => {
              if (error instanceof NotFoundException) return null;
              throw error;
            },
          )
        : null,
      completed: !!progress.get(lessonId)?.completedAt,
      resumePosition: progress.get(lessonId)?.resumePosition ?? 0,
      canRecordProgress: isActive(resultStatus),
    };
  }

  async file(actor: SessionIdentity, id: string, lessonId: string) {
    return this.files.downloadForContent(
      actor,
      async () => {
        const { lesson } = await this.lesson(actor, id, lessonId);
        return lesson.fileId;
      },
      'inline',
    );
  }

  async complete(actor: SessionIdentity, id: string, lessonId: string) {
    const state = await this.lesson(actor, id, lessonId, true);
    if (
      state.lesson.type !== 'TEXT' &&
      state.lesson.type !== 'DOCUMENT' &&
      state.lesson.type !== 'KNOWLEDGE'
    ) {
      throw new BadRequestException('Bài học này tự ghi nhận hoàn thành.');
    }
    if (state.lesson.knowledgeId)
      await this.knowledge.reader(actor, state.lesson.knowledgeId);
    return this.record(state, { completedAt: new Date() });
  }

  async video(
    actor: SessionIdentity,
    id: string,
    lessonId: string,
    body: unknown,
  ) {
    const { duration, position, from } = playbackInput(body);
    const state = await this.lesson(actor, id, lessonId, true);
    if (state.lesson.type !== 'VIDEO')
      throw new BadRequestException('Bài học này không phải video.');
    const prior = state.progress.get(lessonId);
    if (prior?.videoDuration && Math.abs(prior.videoDuration - duration) > 1)
      throw new BadRequestException('Thời lượng video đã thay đổi.');
    const fullDuration = prior?.videoDuration ?? duration;
    const end = Math.min(position, fullDuration);
    const watched = mergePlayback(
      (prior?.watchedSegments ?? []) as VideoSegment[],
      from === undefined ? undefined : Math.min(from, end),
      end,
    );
    const watchedSeconds = watched.reduce(
      (sum, [start, stop]) => sum + stop - start,
      0,
    );
    return this.record(state, {
      resumePosition: end,
      videoDuration: fullDuration,
      watchedSegments: watched,
      completedAt:
        (watchedSeconds / fullDuration) * 100 >=
        learningPolicy.videoCompletionPercent
          ? new Date()
          : undefined,
    });
  }

  async lesson(actor: Learner, id: string, lessonId: string, lock = false) {
    const state = await this.course(actor, id, lock);
    const index = state.lessons.findIndex((lesson) => lesson.id === lessonId);
    if (index < 0) throw new NotFoundException('Không tìm thấy bài học.');
    if (
      state.content.learningMode === 'SEQUENTIAL' &&
      state.lessons
        .slice(0, index)
        .some((lesson) => !state.progress.get(lesson.id)?.completedAt)
    ) {
      throw new ForbiddenException(
        'Hoàn thành các bài trước để mở bài học này.',
      );
    }
    return { ...state, lesson: state.lessons[index] };
  }

  private async course(actor: Learner, id: string, lock = false) {
    const tenantId = actor.tenantId!;
    if (lock) {
      const [row] = await this.db.$queryRaw<{ id: string }[]>`
        SELECT id FROM enrollments
        WHERE tenant_id = ${tenantId}::uuid AND user_id = ${actor.id}::uuid AND id = ${id}::uuid
        FOR UPDATE
      `;
      if (!row) throw missingEnrollment();
    }
    let enrollment = await this.db.enrollment.findFirst({
      where: { tenantId, userId: actor.id, id, status: { not: 'CANCELLED' } },
      include: { lessons: true },
    });
    if (!enrollment) throw missingEnrollment();
    const { content } = await this.training.assignedCourseVersion(
      tenantId,
      enrollment.courseId,
      enrollment.courseVersionId,
    );
    const lessons = content.modules.flatMap((module) => module.lessons);
    const inherited = await this.inheritedProgress(enrollment, content);
    if (
      lock &&
      enrollment.previousEnrollmentId &&
      !enrollment.progressInheritedAt
    ) {
      await this.db.lessonProgress.createMany({
        data: inherited,
        skipDuplicates: true,
      });
      const inheritedEnrollment = await this.db.enrollment.update({
        where: { id },
        data: {
          progressInheritedAt: new Date(),
          progressPercent: percent(
            inherited.filter((row) => row.completedAt).length,
            lessons.length,
          ),
        },
      });
      enrollment = { ...inheritedEnrollment, lessons: enrollment.lessons };
    }
    const progress = new Map(
      [...inherited, ...enrollment.lessons].map((row) => [row.lessonId, row]),
    );
    return { enrollment, content, lessons, progress };
  }

  private async inheritedProgress(
    enrollment: Enrollment,
    content: AssignedContent,
  ) {
    if (!enrollment.previousEnrollmentId || enrollment.progressInheritedAt)
      return [];
    const previous = await this.db.enrollment.findUniqueOrThrow({
      where: { id: enrollment.previousEnrollmentId },
      include: { lessons: true },
    });
    if (!previous.lessons.length) return [];
    const { content: prior } = await this.training.assignedCourseVersion(
      enrollment.tenantId,
      enrollment.courseId,
      previous.courseVersionId,
    );
    const currentLessons = new Map(
      content.modules.flatMap((module) =>
        module.lessons.map((lesson) => [lesson.id, lesson] as const),
      ),
    );
    const oldLessons = new Map(
      prior.modules.flatMap((module) =>
        module.lessons.map((lesson) => [lesson.id, lesson] as const),
      ),
    );
    return previous.lessons.flatMap((row) => {
      const before = oldLessons.get(row.lessonId);
      const after = currentLessons.get(row.lessonId);
      if (!before || !after || !unchangedLesson(before, after)) return [];
      if (after.quizId) {
        const previousQuiz = prior.quizDefinitions?.[after.quizId];
        const currentQuiz = content.quizDefinitions?.[after.quizId];
        if (
          !row.completedAt ||
          !previousQuiz ||
          !currentQuiz ||
          !isDeepStrictEqual(previousQuiz, currentQuiz) ||
          row.quizScore === null ||
          row.quizScore <
            quizLimits(content, after.id, currentQuiz).passingScore
        )
          return [];
      }
      const {
        lessonId,
        resumePosition,
        videoDuration,
        quizScore,
        watchedSegments,
        completedAt,
        updatedAt,
      } = row;
      return [
        {
          tenantId: enrollment.tenantId,
          enrollmentId: enrollment.id,
          lessonId,
          resumePosition,
          videoDuration,
          quizScore,
          watchedSegments: watchedSegments as VideoSegment[],
          completedAt,
          updatedAt,
        },
      ];
    });
  }

  async record(
    {
      enrollment,
      lesson,
      progress,
      lessons,
      content,
    }: Awaited<ReturnType<LearningService['lesson']>>,
    change: Partial<
      Pick<
        LessonProgress,
        'completedAt' | 'resumePosition' | 'videoDuration' | 'quizScore'
      >
    > & { watchedSegments?: VideoSegment[] },
    now = new Date(),
  ) {
    if (!isActive(enrollment.status))
      throw new ForbiddenException('Lượt học đã kết thúc.');
    const completedAt =
      progress.get(lesson.id)?.completedAt ?? change.completedAt;
    const key = {
      tenantId: enrollment.tenantId,
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
    };
    const data = { ...change, completedAt, updatedAt: now };
    const row = await this.db.lessonProgress.upsert({
      where: { tenantId_enrollmentId_lessonId: key },
      create: { ...key, ...data },
      update: data,
    });
    const count = await this.db.lessonProgress.count({
      where: {
        enrollmentId: enrollment.id,
        tenantId: enrollment.tenantId,
        completedAt: { not: null },
      },
    });
    const updated = await this.db.enrollment.update({
      where: { id: enrollment.id },
      data: {
        progressPercent: percent(count, lessons.length),
        startedAt: enrollment.startedAt ?? now,
        status: enrollment.dueAt < now ? 'OVERDUE' : 'IN_PROGRESS',
      },
    });
    const status = await this.completion.evaluate(updated, content, now);
    return {
      completed: !!row.completedAt,
      resumePosition: row.resumePosition,
      status,
    };
  }
}
