import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { SessionIdentity } from '../../auth/permissions';
import { idInput, object } from '../../knowledge/knowledge-input';
import { TenantDatabase } from '../../tenant/tenant-database';
import { TrainingService } from '../training.service';
import { missingTraining, staleTraining } from '../training-workflow';
import { TemplateReleasesService } from './template-releases.service';
import { selectTemplate, type TemplateSource } from './template-selection';

type Course = Awaited<ReturnType<TrainingService['loadCourse']>>;
type Module = Course['modules'][number];
type Lesson = Module['lessons'][number];
type Selection = NonNullable<
  ReturnType<typeof selectTemplate>
>['courses'][number];

function source(value: unknown): TemplateSource | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Partial<TemplateSource>;
  return typeof entry.sourceItemId === 'string' &&
    typeof entry.sourceVersion === 'string' &&
    typeof entry.customized === 'boolean'
    ? {
        sourceItemId: entry.sourceItemId,
        sourceVersion: entry.sourceVersion,
        customized: entry.customized,
      }
    : null;
}

function existingId(
  items: readonly { id: string; templateSource: unknown }[],
  link: TemplateSource,
) {
  return items.find(
    (item) => source(item.templateSource)?.sourceItemId === link.sourceItemId,
  )?.id;
}

function replaceModule(
  candidate: Selection['modules'][number],
  current?: Module,
) {
  return {
    ...candidate,
    id: current?.id,
    lessons: candidate.lessons.map((lesson) => ({
      ...lesson,
      id: existingId(current?.lessons ?? [], lesson.templateSource),
    })),
  };
}

@Injectable()
export class TemplateUpdatesService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(TemplateReleasesService)
    private readonly releases: TemplateReleasesService,
    @Inject(TrainingService) private readonly training: TrainingService,
  ) {}

  private async changes(course: Course) {
    const items = [
      course,
      ...course.modules.flatMap((module) => [module, ...module.lessons]),
    ];
    const versions = [
      ...new Set(
        items.flatMap((item) => {
          const link = source(item.templateSource);
          return link ? [link.sourceVersion] : [];
        }),
      ),
    ];
    if (!versions.length) return [];
    const [releases, originals] = await Promise.all([
      this.releases.latest(),
      this.releases.originals(versions),
    ]);
    function update(
      level: 'course' | 'module' | 'lesson',
      item: Course | Module | Lesson,
    ) {
      const link = source(item.templateSource);
      if (!link) return [];
      const original = originals.get(link.sourceVersion);
      const release = releases.find(
        ({ program }) => program.id === original?.program.id,
      );
      if (!release || release.version === link.sourceVersion) return [];
      const selected = selectTemplate(level, link.sourceItemId, release)
        ?.courses[0];
      if (!selected) return [];
      function scope(selection: Selection) {
        if (level === 'course') return selection;
        if (level === 'module') return selection.modules[0];
        return selection.modules[0].lessons[0];
      }
      const proposed = scope(selected);
      const baseline =
        original &&
        selectTemplate(level, link.sourceItemId, original)?.courses[0];
      const compare = (value: ReturnType<typeof scope>) =>
        JSON.stringify(value, (key, field: unknown) =>
          key === 'sourceVersion' ? undefined : field,
        );
      if (baseline && compare(scope(baseline)) === compare(proposed)) return [];
      return [
        {
          level,
          id: item.id,
          name: item.name,
          customized: link.customized,
          version: release.version,
          notes: release.notes,
          current: item,
          proposed,
          selected,
        },
      ];
    }
    return [
      ...update('course', course),
      ...course.modules.flatMap((module) => [
        ...update('module', module),
        ...module.lessons.flatMap((lesson) => update('lesson', lesson)),
      ]),
    ];
  }

  async list(actor: SessionIdentity, courseId: string) {
    const course = await this.training.loadCourse(actor, courseId);
    return {
      revision: course.revision,
      changes: (await this.changes(course)).map(
        ({
          level,
          id,
          name,
          customized,
          version,
          notes,
          current,
          proposed,
        }) => ({
          level,
          id,
          name,
          customized,
          version,
          notes,
          current,
          proposed,
        }),
      ),
    };
  }

  async apply(actor: SessionIdentity, courseId: string, input: unknown) {
    const { id, level, version, revision, action } = object(input);
    if (action !== 'keep' && action !== 'replace' && action !== 'copy')
      throw new BadRequestException('Chọn Giữ, Thay hoặc Tạo bản sao.');
    const targetId = idInput(id);
    const course = await this.training.loadCourse(actor, courseId);
    if (course.revision !== revision) throw staleTraining();
    const change = (await this.changes(course)).find(
      (item) =>
        item.level === level &&
        item.id === targetId &&
        item.version === version,
    );
    if (!change) throw missingTraining();
    if (action === 'keep') return { courseId };

    const { selected } = change;
    const fullCopy = level === 'course' && action === 'copy';
    let modules: {
      id?: string;
      name: string;
      lessons: { id?: string; name: string }[];
    }[] = course.modules;

    if (level === 'course') {
      modules = selected.modules.map((module) => {
        const id =
          fullCopy || !module.templateSource
            ? undefined
            : existingId(course.modules, module.templateSource);
        return replaceModule(
          module,
          course.modules.find((entry) => entry.id === id),
        );
      });
    } else if (level === 'module') {
      const candidate = selected.modules[0];
      modules = course.modules.flatMap((module) =>
        module.id !== targetId
          ? [module]
          : action === 'copy'
            ? [module, replaceModule(candidate)]
            : [replaceModule(candidate, module)],
      );
    } else {
      const candidate = selected.modules[0].lessons[0];
      modules = course.modules.map((module) => ({
        ...module,
        lessons: module.lessons.flatMap((lesson) =>
          lesson.id !== targetId
            ? [lesson]
            : action === 'copy'
              ? [lesson, candidate]
              : [{ ...candidate, id: lesson.id }],
        ),
      }));
    }

    const draft = await this.training.saveCourse(
      actor,
      {
        departmentId: course.departmentId,
        revision: fullCopy ? undefined : course.revision,
        name: level === 'course' ? selected.name : course.name,
        description:
          level === 'course' ? selected.description : course.description,
        modules,
      },
      fullCopy ? undefined : courseId,
    );
    const tenantId = actor.tenantId!;
    const db = this.database.client;

    if (level === 'course' && selected.templateSource) {
      await db.trainingCourse.update({
        where: { tenantId_id: { tenantId, id: draft.id } },
        data: { templateSource: selected.templateSource },
      });
    }

    for (const [index, module] of modules.entries()) {
      const saved = draft.modules[index];
      const moduleLink =
        'templateSource' in module ? source(module.templateSource) : null;
      if (
        moduleLink?.sourceVersion === change.version &&
        (level === 'course' || level === 'module')
      ) {
        await db.trainingModule.update({
          where: { tenantId_id: { tenantId, id: saved.id } },
          data: { templateSource: moduleLink },
        });
      }
      for (const [position, lesson] of module.lessons.entries()) {
        const link =
          'templateSource' in lesson ? source(lesson.templateSource) : null;
        if (link?.sourceVersion !== change.version) continue;
        await db.trainingLesson.update({
          where: { tenantId_id: { tenantId, id: saved.lessons[position].id } },
          data: { templateSource: link },
        });
      }
    }
    return { courseId: draft.id };
  }
}
