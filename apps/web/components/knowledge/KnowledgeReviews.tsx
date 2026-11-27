'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button, EmptyState } from '../ui/controls';
import { KnowledgePreview } from './Knowledge';
import {
  audienceLabels,
  inputStyle,
  reviewRequest,
  type Draft,
  type DraftRow,
} from './knowledge-data';

export function KnowledgeReviews() {
  const [rows, setRows] = useState<DraftRow[]>();
  const [draft, setDraft] = useState<Draft>();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    void reviewRequest<DraftRow[]>()
      .then((result) => {
        if (active) setRows(result);
      })
      .catch((failure: Error) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, []);

  async function open(id: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setDraft(await reviewRequest<Draft>('/' + id));
      setReason('');
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Chưa mở được phiên bản chờ duyệt.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function decide(version: Draft, decision: 'approve' | 'reject') {
    setBusy(true);
    setError('');
    try {
      await reviewRequest('/' + version.id + '/' + decision, 'POST', {
        token: version.reviewToken,
        ...(decision === 'reject' && { reason }),
      });
      setRows((current) => current?.filter(({ id }) => id !== version.id));
      setDraft(undefined);
      setNotice(
        decision === 'approve'
          ? 'Đã duyệt và xuất bản.'
          : 'Đã trả về bản nháp và thông báo cho người tạo.',
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Chưa lưu được quyết định.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function download(version: Draft, fileId: string) {
    setError('');
    try {
      const { url } = await reviewRequest<{ url: string }>(
        '/' + version.id + '/files/' + fileId,
      );
      window.location.assign(url);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Chưa tải được tệp.',
      );
    }
  }

  function reject(event: FormEvent<HTMLFormElement>, version: Draft) {
    event.preventDefault();
    if (reason.trim()) void decide(version, 'reject');
  }

  return (
    <section className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-teal-800">
          {notice}
        </p>
      )}
      {draft ? (
        <>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setDraft(undefined)}
          >
            Quay lại danh sách
          </Button>
          <KnowledgePreview
            draft={draft}
            onDownload={(id) => void download(draft, id)}
          >
            {draft.canApprove && (
              <Button
                disabled={busy}
                onClick={() => void decide(draft, 'approve')}
              >
                Duyệt và xuất bản
              </Button>
            )}
            <form
              className="space-y-2"
              onSubmit={(event) => reject(event, draft)}
            >
              <label
                className="block text-sm font-semibold"
                htmlFor="knowledge-rejection-reason"
              >
                Lý do từ chối
              </label>
              <textarea
                id="knowledge-rejection-reason"
                className={inputStyle}
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
          </KnowledgePreview>
        </>
      ) : !rows ? (
        !error && <p role="status">Đang tải danh sách chờ duyệt…</p>
      ) : rows.length ? (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0 break-words">
                <p className="font-semibold">{row.title}</p>
                <p className="text-sm text-slate-600">
                  Phiên bản {row.revision} · {audienceLabels[row.audience]}
                </p>
              </div>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void open(row.id)}
              >
                Xem trước
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Chưa có nội dung chờ duyệt" />
      )}
    </section>
  );
}
