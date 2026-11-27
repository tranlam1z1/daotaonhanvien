import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  parseCompletionConfig,
  readConfig,
} from '../organization/organization-input';

type LearningMode = 'SEQUENTIAL' | 'FREE';

export type CourseCompletion = {
  completion: ReturnType<typeof readConfig>['completion'];
  learningMode: LearningMode;
};

export function defaultCourseCompletion(
  tenantConfig: Prisma.JsonValue,
): CourseCompletion {
  return {
    completion: readConfig(tenantConfig).completion,
    learningMode: 'SEQUENTIAL',
  };
}

export function updateCourseCompletion(
  current: CourseCompletion,
  input: { completion?: unknown; learningMode?: unknown },
): CourseCompletion {
  const learningMode =
    input.learningMode === undefined
      ? current.learningMode
      : input.learningMode;
  if (learningMode !== 'SEQUENTIAL' && learningMode !== 'FREE') {
    throw new BadRequestException('Chế độ học không hợp lệ.');
  }
  return {
    completion: parseCompletionConfig(current.completion, input.completion),
    learningMode,
  };
}
