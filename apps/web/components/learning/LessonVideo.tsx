'use client';

import { useRef } from 'react';
import { learningRequest } from './learning-api';

const saveInterval = 5;

export function LessonVideo({
  url,
  path,
  resumeAt,
  record,
  onComplete,
  onError,
}: {
  url: string;
  path: string;
  resumeAt: number;
  record: boolean;
  onComplete: () => void;
  onError: (message: string) => void;
}) {
  const start = useRef<number | undefined>(undefined);
  const last = useRef<number | undefined>(undefined);
  const resumed = useRef(false);
  const notified = useRef(false);
  const pending = useRef(Promise.resolve());

  function save(video: HTMLVideoElement, force = false) {
    const { currentTime: position, duration, seeking } = video;
    if (!record || !Number.isFinite(duration) || duration <= 0 || seeking)
      return;
    if (
      !force &&
      start.current !== undefined &&
      position - start.current < saveInterval
    ) {
      return;
    }
    const from = start.current;
    start.current = position;
    if (position === last.current) return;
    last.current = position;
    pending.current = pending.current.then(async () => {
      try {
        const result = await learningRequest<{ completed: boolean }>(
          path + '/video',
          {
            post: true,
            body: {
              position,
              duration,
              ...(from !== undefined &&
                position >= from &&
                position - from <= 30 && { from }),
            },
          },
        );
        if (result.completed && !notified.current) {
          notified.current = true;
          onComplete();
        }
      } catch (failure) {
        if (failure instanceof Error) onError(failure.message);
      }
    });
  }

  return (
    <div className="space-y-2">
      <video
        className="aspect-video w-full rounded-lg bg-slate-950"
        src={url}
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={({ currentTarget }) => {
          if (resumed.current) return;
          resumed.current = true;
          if (resumeAt && resumeAt < currentTarget.duration)
            currentTarget.currentTime = resumeAt;
        }}
        onPlay={({ currentTarget }) => {
          start.current = currentTarget.currentTime;
        }}
        onSeeking={() => {
          start.current = undefined;
        }}
        onSeeked={({ currentTarget }) => save(currentTarget, true)}
        onTimeUpdate={({ currentTarget }) => {
          if (!currentTarget.paused) save(currentTarget);
        }}
        onPause={({ currentTarget }) => save(currentTarget, true)}
        onEnded={({ currentTarget }) => save(currentTarget, true)}
        onError={() => onError('Trình phát không mở được video này.')}
      />
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center font-semibold text-blue-700 underline"
      >
        Mở nguồn video
      </a>
    </div>
  );
}
