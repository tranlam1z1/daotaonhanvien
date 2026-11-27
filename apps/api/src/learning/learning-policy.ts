import { BadRequestException } from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';

export const activeEnrollmentStatuses = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'OVERDUE',
] as const;

export const learningPolicy = {
  videoCompletionPercent: 80,
  maxPlaybackSegmentSeconds: 30,
} as const;

export type VideoSegment = [number, number];

export function playbackInput(value: unknown) {
  if (!value || typeof value !== 'object') throw invalidProgress();
  const { position, duration, from } = value as Record<string, unknown>;
  if (
    typeof position !== 'number' ||
    !Number.isFinite(position) ||
    typeof duration !== 'number' ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    position < 0 ||
    position > duration ||
    (from !== undefined &&
      (typeof from !== 'number' ||
        !Number.isFinite(from) ||
        from < 0 ||
        from > position ||
        position - from > learningPolicy.maxPlaybackSegmentSeconds))
  ) {
    throw invalidProgress();
  }
  return { position, duration, from };
}

export function mergePlayback(
  watched: VideoSegment[],
  from: number | undefined,
  position: number,
) {
  if (from === undefined || from === position) return watched;
  const sorted: VideoSegment[] = [...watched, [from, position]];
  sorted.sort(([left], [right]) => left - right);
  const result: VideoSegment[] = [];
  for (const [start, end] of sorted) {
    const previous = result.at(-1);
    if (previous && start <= previous[1]) {
      previous[1] = Math.max(end, previous[1]);
    } else {
      result.push([start, end]);
    }
  }
  return result;
}

type LessonContent = {
  id: string;
  name: string;
  durationMinutes: number;
  type: string;
  body: string | null;
  videoUrl: string | null;
  fileId: string | null;
  knowledgeId: string | null;
  quizId: string | null;
};

export function unchangedLesson(before: LessonContent, after: LessonContent) {
  const content = (lesson: LessonContent) => {
    const {
      id,
      name,
      durationMinutes,
      type,
      body,
      videoUrl,
      fileId,
      knowledgeId,
      quizId,
    } = lesson;
    return {
      id,
      name,
      durationMinutes,
      type,
      body,
      videoUrl,
      fileId,
      knowledgeId,
      quizId,
    };
  };
  return isDeepStrictEqual(content(before), content(after));
}

function invalidProgress() {
  return new BadRequestException('Dữ liệu tiến độ video không hợp lệ.');
}
