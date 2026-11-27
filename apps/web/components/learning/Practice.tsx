'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button, EmptyState } from '../ui/controls';
import { learningRequest } from './learning-api';

type Entry = {
  id: string;
  status: string;
  employee: string;
  course: string;
  practice: { passed: boolean; comment: string; confirmedAt: string } | null;
};

export function Practice() {
  const [entries, setEntries] = useState<Entry[]>();
  const [editing, setEditing] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void learningRequest<Entry[]>('/practice/list', {
      signal: controller.signal,
    })
      .then(setEntries)
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [revision]);

  async function confirm(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await learningRequest<{ status: string }>(
        '/practice/' + id + '/confirm',
        {
          post: true,
          body: {
            passed: values.get('passed') === 'yes',
            comment: values.get('comment'),
          },
        },
      );
      setEditing(undefined);
      setRevision((value) => value + 1);
      setMessage(
        result.status === 'COMPLETED'
          ? 'Đã xác nhận. Lượt học đã hoàn thành.'
          : 'Đã lưu kết quả thực hành.',
      );
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-teal-800">
          {message}
        </p>
      )}
      {!entries && !error && <p role="status">Đang tải lượt thực hành…</p>}
      {entries?.length === 0 && (
        <EmptyState title="Chưa có lượt học cần xác nhận thực hành." />
      )}
      <ul className="space-y-3">
        {entries?.map((entry) => (
          <li
            key={entry.id}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
          >
            <h2 className="break-words font-semibold">{entry.course}</h2>
            <p className="break-words">
              {entry.employee} ·{' '}
              {entry.practice
                ? entry.practice.passed
                  ? 'Đạt'
                  : 'Chưa đạt'
                : 'Chờ xác nhận'}
            </p>
            {entry.practice && (
              <p className="whitespace-pre-wrap break-words text-sm">
                {entry.practice.comment}
              </p>
            )}
            {editing === entry.id ? (
              <form
                onSubmit={(event) => void confirm(event, entry.id)}
                className="space-y-3"
              >
                <label className="block">
                  Kết quả thực hành
                  <select
                    name="passed"
                    defaultValue={
                      entry.practice?.passed === undefined
                        ? ''
                        : entry.practice.passed
                          ? 'yes'
                          : 'no'
                    }
                    className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 p-2"
                    required
                  >
                    <option value="">Chọn kết quả</option>
                    <option value="yes">Đạt</option>
                    <option value="no">Chưa đạt</option>
                  </select>
                </label>
                <label className="block">
                  Nhận xét
                  <textarea
                    name="comment"
                    required
                    defaultValue={entry.practice?.comment ?? ''}
                    maxLength={2000}
                    rows={3}
                    className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={busy}>
                    Lưu xác nhận
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setEditing(undefined)}
                  >
                    Hủy
                  </Button>
                </div>
              </form>
            ) : (
              entry.status !== 'COMPLETED' && (
                <Button
                  variant="secondary"
                  onClick={() => setEditing(entry.id)}
                >
                  Xác nhận thực hành
                </Button>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
