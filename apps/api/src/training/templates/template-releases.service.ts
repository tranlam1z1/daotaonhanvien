import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { questionInput } from '../../assessments/assessment-input';
import { object, text } from '../../knowledge/knowledge-input';
import { TenantDatabase } from '../../tenant/tenant-database';
import { courseInput, programInput } from '../training-input';
import { onboardingRelease, type TemplateRelease } from './template-fixture';

type PublishedTemplate = TemplateRelease & {
  industry: string;
  positionGroup: string;
  notes: string;
  questions: ReturnType<typeof questionInput>[];
};

const initial: PublishedTemplate = {
  ...onboardingRelease,
  questions: [],
  industry: 'Tất cả ngành nghề',
  positionGroup: 'Nhân viên mới',
  notes: 'Phiên bản hội nhập ban đầu.',
};

function entries(value: unknown, max: number): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > max)
    throw new BadRequestException('Số lượng mục mẫu không hợp lệ.');
  return value.map(object);
}

function parseRelease(input: unknown) {
  const data = object(input);
  const program = object(data.program);
  const ids = new Set<string>();
  function itemId(value: unknown) {
    const id = text(value, 100, 'Mã mục mẫu', true);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id))
      throw new BadRequestException(
        'Mã mục mẫu phải hợp lệ và duy nhất trong chương trình.',
      );
    ids.add(id);
    return id;
  }

  const programFields = programInput({
    ...program,
    courseIds: [],
    departmentId: null,
  });
  const content: TemplateRelease['program'] = {
    id: itemId(program.id),
    name: programFields.name,
    description: programFields.description,
    audience: programFields.audience,
    type: programFields.type,
    targetDuration: programFields.targetDuration,
    targetUnit: programFields.targetUnit,
    courses: entries(program.courses, 100).map((course) => {
      const modules = entries(course.modules, 100).map((module) => ({
        id: itemId(module.id),
        name: module.name,
        lessons: entries(module.lessons, 100).map((lesson) => ({
          id: itemId(lesson.id),
          name: lesson.name,
          body: lesson.body,
          durationMinutes: lesson.durationMinutes,
        })),
      }));
      const fields = courseInput({
        name: course.name,
        description: course.description,
        modules: modules.map((module) => ({
          name: module.name,
          lessons: module.lessons.map(({ name, body, durationMinutes }) => ({
            name,
            body,
            durationMinutes,
            type: 'TEXT',
          })),
        })),
      });
      return {
        id: itemId(course.id),
        name: fields.name,
        description: fields.description,
        modules: fields.modules.map((module, i) => ({
          id: modules[i].id,
          name: module.name,
          lessons: module.lessons.map((lesson, j) => ({
            id: modules[i].lessons[j].id,
            name: lesson.name,
            durationMinutes: lesson.durationMinutes,
            type: 'TEXT',
            body: lesson.body!,
          })),
        })),
      };
    }),
  };
  return {
    version: randomUUID(),
    industry: text(data.industry, 200, 'Ngành nghề', true),
    positionGroup: text(data.positionGroup, 200, 'Nhóm vị trí', true),
    notes: text(data.notes, 5000, 'Ghi chú thay đổi', true),
    program: content,
    questions:
      data.questions == null ||
      (Array.isArray(data.questions) && !data.questions.length)
        ? []
        : entries(data.questions, 500).map(questionInput),
  };
}

@Injectable()
export class TemplateReleasesService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  async latest(): Promise<PublishedTemplate[]> {
    const rows = await this.database.client.$queryRaw<PublishedTemplate[]>`
      SELECT DISTINCT ON (program_id)
        version, industry, position_group AS "positionGroup", notes, questions, content AS program
      FROM training_template_releases
      ORDER BY program_id, sequence DESC
    `;
    return rows.some(({ program }) => program.id === initial.program.id)
      ? rows
      : [initial, ...rows];
  }

  async originals(versions: string[]): Promise<Map<string, TemplateRelease>> {
    const rows = await this.database.client.$queryRaw<TemplateRelease[]>`
      SELECT version, content AS program FROM training_template_releases
      WHERE version = ANY(${versions}::text[])
    `;
    return new Map(
      [initial, ...rows].map((release) => [release.version, release]),
    );
  }

  async publish(input: unknown, actorId: string, ip?: string) {
    const { version, industry, positionGroup, notes, program, questions } =
      parseRelease(input);
    return this.database.runPlatform(null, async () => {
      await this.database.client.$executeRaw`
        INSERT INTO training_template_releases
          (version, program_id, industry, position_group, notes, content, questions)
        VALUES (${version}, ${program.id}, ${industry}, ${positionGroup}, ${notes},
                ${JSON.stringify(program)}::jsonb, ${JSON.stringify(questions)}::jsonb)
      `;
      await this.database.client.auditLog.createMany({
        data: {
          userId: actorId,
          ip,
          action: 'PUBLISH_TRAINING_TEMPLATE',
          objectType: 'TrainingTemplateRelease',
          objectId: version,
          after: { programId: program.id, name: program.name, notes },
        },
      });
      return { version, industry, positionGroup, notes, program, questions };
    });
  }
}
