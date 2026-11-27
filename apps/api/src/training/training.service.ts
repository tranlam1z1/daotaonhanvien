import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { SessionIdentity } from '../auth/permissions';
import { attachableFileWhere } from '../files/file-access';
import { FilesService } from '../files/files.service';
import { object } from '../knowledge/knowledge-input';
import { contentContext, KnowledgeService } from '../knowledge/knowledge.service';
import { readConfig } from '../organization/organization-input';
import { TenantDatabase } from '../tenant/tenant-database';
import {
  defaultCourseCompletion,
  updateCourseCompletion,
} from '../training-policy/course-completion';
import {
  courseDurationMinutes,
  programDuration,
} from '../training-policy/training-duration';
import { courseInput, labels, programInput } from './training-input';
import {
  canUseTraining as editable,
  draftChanges,
  missingTraining as notFound,
  staleTraining as stale,
  workflowFields,
  workflowState,
  type ContentPermission,
} from './training-workflow';

const courseDetails = {
  modules: {
    orderBy: { position: 'asc' },
    include: {
      lessons: { orderBy: { position: 'asc' }, include: { file: { select: labels } } },
    },
  },
} as const;
const lessonDurations = {
  modules: { select: { lessons: { select: { durationMinutes: true } } } },
} as const;
const programCourses = {
  select: { courseId: true, course: { select: lessonDurations } },
  orderBy: [{ position: 'asc' }, { courseId: 'asc' }],
} satisfies Prisma.TrainingProgram$coursesArgs;

type Program = Prisma.TrainingProgramGetPayload<{
  include: { courses: typeof programCourses };
}>;

function presentProgram(program: Program) {
  return {
    id: program.id,
    tenantId: program.tenantId,
    status: program.status,
    rejectionReason: program.rejectionReason,
    templateSource: program.templateSource,
    departmentId: program.departmentId,
    name: program.name,
    description: program.description,
    audience: program.audience,
    type: program.type,
    targetDuration: program.targetDuration,
    targetUnit: program.targetUnit,
    revision: program.revision,
    ...programDuration(program),
    courses: program.courses.map(({ courseId }) => ({ courseId })),
  };
}
type Course = Prisma.TrainingCourseGetPayload<{ include: typeof courseDetails }>;
type CourseInput = ReturnType<typeof courseInput>;
type Modules = CourseInput['modules'];

function invalidReference() {
  return new BadRequestException('Có tham chiếu không hợp lệ hoặc bạn không có quyền truy cập.');
}

function departmentFilter(actor: SessionIdentity) {
  const ids = contentContext(actor, 'content.edit')?.departmentIds;
  return ids ? { in: ids } : undefined;
}

function requireScope(actor: SessionIdentity, departmentId: string | null) {
  if (!editable(actor, { tenantId: actor.tenantId!, departmentId }))
    throw new ForbiddenException('Bạn không có quyền soạn thảo trong phạm vi này.');
}

function existingIds<T extends { id: string }>(
  requested: { id: string | null }[],
  existing: T[],
) {
  const ids = requested.flatMap(({ id }) => id ? [id] : []);
  const known = new Map(existing.map((row) => [row.id, row]));
  if (new Set(ids).size !== ids.length || ids.some((id) => !known.has(id)))
    throw invalidReference();
  return { ids, known };
}

@Injectable()
export class TrainingService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}

  private get db() {
    return this.database.client;
  }

  async editor(actor: SessionIdentity) {
    const tenantId = actor.tenantId!;
    const departmentId = departmentFilter(actor);
    const [departments, programs, courses, knowledge, quizzes, config] = await Promise.all([
      this.db.department.findMany({
        where: { tenantId, id: departmentId, status: 'ACTIVE', deletedAt: null },
        select: labels,
        orderBy: { name: 'asc' },
      }),
      this.db.trainingProgram.findMany({
        where: { tenantId, departmentId },
        include: { courses: programCourses },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.db.trainingCourse.findMany({
        where: { tenantId, departmentId },
        select: { ...workflowFields, ...lessonDurations },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.knowledge.readableTitles(actor),
      this.db.quiz.findMany({
        where: { tenantId, departmentId },
        select: { ...labels, departmentId: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.companyConfig(tenantId),
    ]);
    const { selfApproval } = readConfig(config);
    return {
      departments,
      programs: programs.map((program) => ({
        ...presentProgram(program),
        ...workflowState(actor, program, selfApproval),
      })),
      courses: courses.map((course) => ({
        id: course.id,
        name: course.name,
        departmentId: course.departmentId,
        revision: course.revision,
        ...workflowState(actor, course, selfApproval),
        totalDurationMinutes: courseDurationMinutes(course),
      })),
      knowledge,
      quizzes,
      defaults: defaultCourseCompletion(config),
      tenantWide: !departmentId,
    };
  }

  async saveProgram(actor: SessionIdentity, input: unknown, id?: string) {
    const { courseIds, revision, ...data } = programInput(input);
    const author = await this.knowledge.lockEditor(actor);
    const tenantId = author.tenantId!;
    const current = id
      ? await this.db.trainingProgram.findUnique({
          where: { tenantId_id: { tenantId, id } },
        })
      : null;
    if (id && (!current || !editable(author, current))) throw notFound();
    if (current) {
      if (current.revision !== revision) throw stale();
      if (data.departmentId !== current.departmentId) throw invalidReference();
    } else {
      await this.checkNewScope(author, data.departmentId);
    }

    const count = await this.db.trainingCourse.count({
      where: { tenantId, id: { in: courseIds }, departmentId: data.departmentId },
    });
    if (count !== courseIds.length) throw invalidReference();

    const program = current
      ? await this.db.trainingProgram.update({
          where: { tenantId_id: { tenantId, id: current.id } },
          data: {
            ...data,
            ...draftChanges(current.status, current.authorId, author.id),
          },
        })
      : await this.db.trainingProgram.create({
          data: { ...data, tenantId, authorId: author.id },
        });
    await this.db.programCourse.deleteMany({
      where: { tenantId, programId: program.id, courseId: { notIn: courseIds } },
    });
    for (const [position, courseId] of courseIds.entries()) {
      const link = { tenantId, programId: program.id, courseId };
      await this.db.programCourse.upsert({
        where: { tenantId_programId_courseId: link },
        create: { ...link, position },
        update: { position },
      });
    }
    return presentProgram(await this.db.trainingProgram.findUniqueOrThrow({
      where: { tenantId_id: { tenantId, id: program.id } },
      include: { courses: programCourses },
    }));
  }

  async course(actor: SessionIdentity, id: string) {
    return this.presentCourse(actor, await this.loadCourse(actor, id));
  }

  async saveCourse(actor: SessionIdentity, input: unknown, id?: string) {
    const { modules, revision, programId, ...data } = courseInput(input);
    const author = await this.knowledge.lockEditor(actor);
    const tenantId = author.tenantId!;
    const current = id ? await this.loadCourse(author, id) : null;
    if (current) {
      if (current.revision !== revision) throw stale();
      if (data.departmentId !== current.departmentId || programId)
        throw invalidReference();
    } else {
      await this.checkNewScope(author, data.departmentId);
    }

    const program = programId
      ? await this.db.trainingProgram.findUnique({
          where: { tenantId_id: { tenantId, id: programId } },
        })
      : null;
    if (programId && (!program || program.departmentId !== data.departmentId))
      throw invalidReference();

    await this.checkReferences(author, data.departmentId, modules, current);
    const settings = updateCourseCompletion(
      current ? await this.courseCompletion(current) : await this.completionDefaults(tenantId),
      object(input),
    );
    const course = current
      ? await this.db.trainingCourse.update({
          where: { tenantId_id: { tenantId, id: current.id } },
          data: {
            ...data,
            ...settings,
            ...draftChanges(current.status, current.authorId, author.id),
          },
        })
      : await this.db.trainingCourse.create({
          data: { ...data, ...settings, tenantId, authorId: author.id },
        });
    await this.saveModules(tenantId, course.id, modules, current?.modules ?? []);
    if (program && programId) {
      await this.db.trainingProgram.update({
        where: { tenantId_id: { tenantId, id: programId } },
        data: draftChanges(program.status, program.authorId, author.id),
      });
      const { _max } = await this.db.programCourse.aggregate({
        where: { tenantId, programId },
        _max: { position: true },
      });
      await this.db.programCourse.create({
        data: { tenantId, programId, courseId: course.id, position: (_max.position ?? -1) + 1 },
      });
    }
    return this.course(author, course.id);
  }

  async copyCourse(actor: SessionIdentity, id: string, rawName: unknown) {
    const author = await this.knowledge.lockEditor(actor);
    const tenantId = author.tenantId!;
    const source = await this.loadCourse(author, id);
    const { name, description, departmentId, modules } = courseInput({
      name: rawName,
      description: source.description,
      departmentId: source.departmentId,
      modules: source.modules.map((module) => ({
        name: module.name,
        lessons: module.lessons.map((lesson) => ({ ...lesson, id: null })),
      })),
    });
    await this.checkReferences(author, departmentId, modules, source);
    const copy = await this.db.trainingCourse.create({
      data: {
        tenantId,
        name,
        description,
        departmentId,
        authorId: author.id,
        ...(await this.courseCompletion(source)),
      },
    });
    await this.saveModules(tenantId, copy.id, modules, []);
    return this.course(author, copy.id);
  }

  download(
    actor: SessionIdentity,
    courseId: string,
    lessonId: string,
    permission: ContentPermission = 'content.edit',
  ) {
    return this.files.downloadForContent(actor, async (db) => {
      const tenantId = actor.tenantId!;
      const lesson = await db.trainingLesson.findFirst({
        where: {
          tenantId,
          id: lessonId,
          module: {
            courseId,
            ...(permission === 'content.approve' && {
              course: { status: 'IN_REVIEW' },
            }),
          },
        },
        select: {
          fileId: true,
          module: { select: { course: { select: { tenantId: true, departmentId: true } } } },
        },
      });
      return lesson && editable(actor, lesson.module.course, permission)
        ? lesson.fileId
        : null;
    });
  }

  private async checkNewScope(actor: SessionIdentity, departmentId: string | null) {
    requireScope(actor, departmentId);
    if (!departmentId) return;
    const department = await this.db.department.findFirst({
      where: { tenantId: actor.tenantId!, id: departmentId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    if (!department) throw invalidReference();
  }

  private async loadCourse(actor: SessionIdentity, id: string) {
    const course = await this.db.trainingCourse.findUnique({
      where: { tenantId_id: { tenantId: actor.tenantId!, id } },
      include: courseDetails,
    });
    if (!course || !editable(actor, course)) throw notFound();
    return course;
  }

  private async presentCourse(actor: SessionIdentity, course: Course) {
    const lessons = course.modules.flatMap((module) => module.lessons);
    const visible = new Set((await this.knowledge.readableTitles(
      actor,
      lessons.flatMap(({ knowledgeId }) => knowledgeId ? [knowledgeId] : []),
    )).map(({ id }) => id));
    const content = await this.courseContent(course);
    return {
      id: course.id,
      departmentId: course.departmentId,
      status: course.status,
      revision: course.revision,
      rejectionReason: course.rejectionReason,
      ...content,
      modules: content.modules.map((module) => ({
        ...module,
        lessons: module.lessons.map((lesson) => ({
          ...lesson,
          knowledgeId: visible.has(lesson.knowledgeId ?? '') ? lesson.knowledgeId : null,
        })),
      })),
    };
  }

  async courseSnapshot(tenantId: string, id: string) {
    const course = await this.db.trainingCourse.findUniqueOrThrow({
      where: { tenantId_id: { tenantId, id } },
      include: courseDetails,
    });
    return this.courseContent(course);
  }

  private async courseContent(course: Course) {
    const { name, description } = course;
    return {
      name,
      description,
      templateSource: course.templateSource,
      ...(await this.courseCompletion(course)),
      totalDurationMinutes: courseDurationMinutes(course),
      modules: course.modules.map((module) => ({
        id: module.id,
        templateSource: module.templateSource,
        name: module.name,
        lessons: module.lessons.map((lesson) => ({
          id: lesson.id,
          templateSource: lesson.templateSource,
          name: lesson.name,
          durationMinutes: lesson.durationMinutes,
          type: lesson.type,
          body: lesson.body,
          videoUrl: lesson.videoUrl,
          fileId: lesson.fileId,
          file: lesson.file,
          knowledgeId: lesson.knowledgeId,
          quizId: lesson.quizId,
        })),
      })),
    };
  }

  private async completionDefaults(tenantId: string) {
    return defaultCourseCompletion(await this.companyConfig(tenantId));
  }

  private async companyConfig(tenantId: string) {
    const { config } = await this.db.tenant.findFirstOrThrow({
      where: { id: tenantId },
      select: { config: true },
    });
    return config;
  }

  private async courseCompletion(course: Course) {
    const { completion } = course.completion === null
      ? await this.completionDefaults(course.tenantId)
      : defaultCourseCompletion({ completion: course.completion });
    return { completion, learningMode: course.learningMode };
  }

  private async checkReferences(
    actor: SessionIdentity,
    departmentId: string | null,
    modules: Modules,
    source: Course | null,
  ) {
    const lessons = modules.flatMap((module) => module.lessons);
    const retained = source?.modules.flatMap((module) =>
      module.lessons.flatMap(({ fileId }) => fileId ? [fileId] : []),
    ) ?? [];
    const fileIds = [...new Set(lessons.flatMap(({ fileId }) => fileId ? [fileId] : []))];
    const knowledgeIds = [...new Set(lessons.flatMap(({ knowledgeId }) => knowledgeId ? [knowledgeId] : []))];
    const quizIds = [...new Set(lessons.flatMap(({ quizId }) => quizId ? [quizId] : []))];
    const [files, knowledge, quizCount] = await Promise.all([
      fileIds.length ? this.db.fileObject.findMany({
        where: { ...attachableFileWhere(actor, retained), id: { in: fileIds } },
        select: { id: true, contentType: true },
      }) : [],
      this.knowledge.readableTitles(actor, knowledgeIds),
      quizIds.length ? this.db.quiz.count({
        where: { tenantId: actor.tenantId!, departmentId, id: { in: quizIds } },
      }) : 0,
    ]);
    const types = new Map(files.map(({ id, contentType }) => [id, contentType]));
    if (
      knowledge.length !== knowledgeIds.length ||
      quizCount !== quizIds.length ||
      lessons.some(({ fileId, type }) => {
        if (!fileId) return false;
        const contentType = types.get(fileId);
        return !contentType || contentType.startsWith('video/') !== (type === 'VIDEO');
      })
    ) throw invalidReference();
  }

  private async saveModules(tenantId: string, courseId: string, modules: Modules, existing: Course['modules']) {
    const { ids, known } = existingIds(modules, existing);
    if (ids.length !== existing.length)
      await this.db.trainingModule.deleteMany({ where: { tenantId, courseId, id: { notIn: ids } } });
    for (const { id, lessons, ...data } of modules) {
      const module = id
        ? await this.db.trainingModule.update({ where: { tenantId_id: { tenantId, id } }, data })
        : await this.db.trainingModule.create({ data: { ...data, tenantId, courseId } });
      const current = id ? known.get(id)!.lessons : [];
      const { ids: lessonIds } = existingIds(lessons, current);
      if (lessonIds.length !== current.length)
        await this.db.trainingLesson.deleteMany({ where: { tenantId, moduleId: module.id, id: { notIn: lessonIds } } });
      const created = [];
      for (const { id: lessonId, ...lesson } of lessons) {
        if (lessonId)
          await this.db.trainingLesson.update({ where: { tenantId_id: { tenantId, id: lessonId } }, data: lesson });
        else
          created.push({ ...lesson, tenantId, moduleId: module.id });
      }
      if (created.length) await this.db.trainingLesson.createMany({ data: created });
    }
  }
}
