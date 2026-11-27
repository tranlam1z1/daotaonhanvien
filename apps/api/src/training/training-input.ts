import { BadRequestException } from '@nestjs/common';
import {
  httpsVideo,
  idInput,
  object,
  text,
} from '../knowledge/knowledge-input';

export const labels = { id: true, name: true } as const;

function invalid(): never {
  throw new BadRequestException('Dữ liệu đào tạo không hợp lệ.');
}

function oneOf<const T extends string>(value: unknown, options: readonly T[]) {
  const match = options.find((option) => option === value);
  return match ?? invalid();
}

function positiveInteger(value: unknown) {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 2147483647
  )
    return invalid();
  return value;
}

function list<T>(
  value: unknown,
  parse: (entry: unknown, position: number) => T,
  limit: number,
) {
  if (!Array.isArray(value) || value.length > limit) return invalid();
  return value.map(parse);
}

function optionalId(value: unknown) {
  return value == null ? null : idInput(value);
}

export function programInput(body: unknown) {
  const data = object(body);
  const courseIds = list(data.courseIds, idInput, 100);
  if (new Set(courseIds).size !== courseIds.length) return invalid();
  return {
    revision:
      data.revision === undefined ? undefined : positiveInteger(data.revision),
    departmentId: optionalId(data.departmentId),
    name: text(data.name, 200, 'Tên chương trình', true),
    description: text(data.description, 5000, 'Mô tả', true),
    audience: text(data.audience, 1000, 'Đối tượng', true),
    type: oneOf(data.type, ['ONBOARDING', 'SPECIALIST']),
    targetUnit: oneOf(data.targetUnit, ['DAYS', 'HOURS']),
    targetDuration: positiveInteger(data.targetDuration),
    courseIds,
  };
}

function lessonInput(value: unknown, position: number) {
  const data = object(value);
  const type = oneOf(data.type, [
    'TEXT',
    'DOCUMENT',
    'VIDEO',
    'KNOWLEDGE',
    'QUIZ',
  ]);
  const fileId =
    type === 'DOCUMENT'
      ? idInput(data.fileId)
      : type === 'VIDEO'
        ? optionalId(data.fileId)
        : null;
  const videoUrl = type === 'VIDEO' ? httpsVideo(data.videoUrl) : null;
  if (type === 'VIDEO' && !!fileId === !!videoUrl) {
    throw new BadRequestException(
      'Chọn một tệp video hoặc một liên kết HTTPS.',
    );
  }
  return {
    id: optionalId(data.id),
    position,
    name: text(data.name, 200, 'Tên bài học', true),
    durationMinutes: positiveInteger(data.durationMinutes),
    type,
    fileId,
    videoUrl,
    body:
      type === 'TEXT' ? text(data.body, 50_000, 'Văn bản bài học', true) : null,
    knowledgeId: type === 'KNOWLEDGE' ? idInput(data.knowledgeId) : null,
    quizId: type === 'QUIZ' ? idInput(data.quizId) : null,
  };
}

export function courseInput(body: unknown) {
  const data = object(body);
  const modules = list(
    data.modules,
    (value, position) => {
      const module = object(value);
      return {
        id: optionalId(module.id),
        name: text(module.name, 200, 'Tên module', true),
        position,
        lessons: list(module.lessons, lessonInput, 100),
      };
    },
    100,
  );
  if (modules.reduce((total, module) => total + module.lessons.length, 0) > 500)
    return invalid();
  return {
    revision:
      data.revision === undefined ? undefined : positiveInteger(data.revision),
    departmentId: optionalId(data.departmentId),
    programId: optionalId(data.programId),
    name: text(data.name, 200, 'Tên khóa học', true),
    description: text(data.description, 5000, 'Mô tả'),
    modules,
  };
}
