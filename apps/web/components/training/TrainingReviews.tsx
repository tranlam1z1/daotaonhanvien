'use client';

import { useEffect, useState } from 'react';
import { Button, EmptyState } from '../ui/controls';
import { panel, TextArea } from './TrainingFields';
import {
  lessonTypes,
  trainingApi,
  type Course,
  type Program,
  type TrainingKind,
  type Workflow,
} from './training-data';

type ReviewRow = {
  id: string;
  kind: TrainingKind;
  name: string;
  revision: number;
};
type Preview = Omit<ReviewRow, 'name'> &
  Workflow & {
    content: Course | Program;
    courseNames: string[];
  };

const kinds = { courses: 'Khóa học', programs: 'Chương trình' };

export function TrainingReviews() {
  const [rows, setRows] = useState<ReviewRow[]>();
  const [preview, setPreview] = useState<Preview>();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void trainingApi<ReviewRow[]>(
      '/reviews',
      'GET',
      undefined,
      controller.signal,
    )
      .then(setRows)
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, []);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function open(row: ReviewRow) {
    setPreview(
      await trainingApi<Preview>('/reviews/' + row.kind + '/' + row.id),
    );
    setReason('');
  }

  async function decide(item: Preview, decision: 'approve' | 'reject') {
    await trainingApi(
      '/reviews/' + item.kind + '/' + item.id + '/' + decision,
      'POST',
      {
        token: item.reviewToken,
        ...(decision === 'reject' && { reason }),
      },
    );
    setRows((current) => current?.filter(({ id }) => id !== item.id));
    setPreview(undefined);
    setNotice(
      decision === 'approve'
        ? 'Đã duyệt và xuất bản.'
        : 'Đã trả về Nháp và thông báo cho người tạo.',
    );
  }

  async function download(courseId: string, lessonId: string) {
    const { url } = await trainingApi<{ url: string }>(
      '/reviews/courses/' + courseId + '/lessons/' + lessonId + '/file',
    );
    window.location.assign(url);
  }

  return (
    <section className={panel}>
      <h2 className="text-lg font-semibold text-navy-900">Đào tạo chờ duyệt</h2>
      {error && (
        <p role="alert" className="break-words text-sm text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-teal-800">
          {notice}
        </p>
      )}
      {preview ? (
        <div className="space-y-4">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setPreview(undefined)}
          >
            Quay lại danh sách đào tạo
          </Button>
          <h3 className="break-words font-semibold">{preview.content.name}</h3>
          <p className="text-sm text-slate-600">
            {kinds[preview.kind]} · Phiên bản {preview.revision}
          </p>
          <p className="whitespace-pre-wrap break-words text-sm">
            {preview.content.description}
          </p>
          {'modules' in preview.content ? (
            <>
              <p className="text-sm text-slate-600">
                {preview.content.totalDurationMinutes} phút ·{' '}
                {preview.content.learningMode === 'SEQUENTIAL'
                  ? 'Tuần tự'
                  : 'Tự do'}
              </p>
              <ol className="space-y-3">
                {preview.content.modules.map((module) => (
                  <li key={module.id} className="space-y-1 break-words text-sm">
                    <p className="font-semibold">{module.name}</p>
                    <ol className="list-inside list-decimal space-y-1 pl-2">
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id}>
                          {lesson.name} · {lessonTypes[lesson.type]} ·{' '}
                          {lesson.durationMinutes} phút
                          {lesson.body && (
                            <p className="whitespace-pre-wrap">{lesson.body}</p>
                          )}
                          {lesson.videoUrl && (
                            <a
                              className="block text-blue-700 underline"
                              href={lesson.videoUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Mở video
                            </a>
                          )}
                          {lesson.file && lesson.id && (
                            <Button
                              variant="secondary"
                              disabled={busy}
                              onClick={() =>
                                void run(() => download(preview.id, lesson.id!))
                              }
                            >
                              Tải {lesson.file.name}
                            </Button>
                          )}
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <p className="break-words text-sm">
                {preview.content.type === 'ONBOARDING'
                  ? 'Hội nhập'
                  : 'Chuyên môn'}{' '}
                · {preview.content.audience} · {preview.content.targetDuration}{' '}
                {preview.content.targetUnit === 'DAYS' ? 'ngày' : 'giờ'}
              </p>
              <ol className="list-inside list-decimal break-words text-sm">
                {preview.courseNames.map((name, index) => (
                  <li key={index}>{name}</li>
                ))}
              </ol>
            </>
          )}
          {preview.canApprove && (
            <Button
              disabled={busy}
              onClick={() => void run(() => decide(preview, 'approve'))}
            >
              Duyệt và xuất bản
            </Button>
          )}
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (reason.trim()) void run(() => decide(preview, 'reject'));
            }}
          >
            <TextArea
              label="Lý do từ chối đào tạo"
              value={reason}
              maxLength={2000}
              required
              onChange={(event) => setReason(event.target.value)}
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={busy || !reason.trim()}
            >
              Từ chối
            </Button>
          </form>
        </div>
      ) : rows?.length ? (
        <ul className="divide-y divide-slate-200">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0 break-words">
                <p className="font-semibold">{row.name}</p>
                <p className="text-sm text-slate-600">
                  {kinds[row.kind]} · Phiên bản {row.revision}
                </p>
              </div>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void run(() => open(row))}
              >
                Xem trước
              </Button>
            </li>
          ))}
        </ul>
      ) : rows ? (
        <EmptyState title="Chưa có đào tạo chờ duyệt" />
      ) : (
        !error && <p role="status">Đang tải danh sách chờ duyệt…</p>
      )}
    </section>
  );
}
