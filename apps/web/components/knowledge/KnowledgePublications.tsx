'use client';

import { useEffect, useState } from 'react';
import { Button, EmptyState } from '../ui/controls';
import { editorRequest, type Draft, type Publication } from './knowledge-data';
import { PublishedDetail } from './PublishedDetail';

const publicationPath = '/publications';
const date = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Ho_Chi_Minh',
});

export function KnowledgePublications({
  onDraft,
}: {
  onDraft?: (draft: Draft) => void;
}) {
  const [publications, setPublications] = useState<Publication[]>();
  const [history, setHistory] = useState<{
    itemId: string;
    versions: Publication[];
  }>();
  const [versionId, setVersionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    void editorRequest<Publication[]>(publicationPath)
      .then((result) => {
        if (active) setPublications(result);
      })
      .catch((failure: Error) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, []);

  async function openHistory(itemId: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const versions = await editorRequest<Publication[]>(
        publicationPath + '/' + itemId + '/history',
      );
      setHistory({ itemId, versions });
      setVersionId('');
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Chưa tải được lịch sử.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function revise(row: Publication) {
    setBusy(true);
    setError('');
    try {
      const draft = await editorRequest<Draft>(
        publicationPath + '/' + row.itemId + '/history/' + row.id + '/draft',
        'POST',
      );
      onDraft?.(draft);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Chưa tạo được bản nháp mới.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function change(row: Publication) {
    const archive = row.status === 'PUBLISHED';
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await editorRequest<Publication>(
        publicationPath +
          '/' +
          row.itemId +
          (archive ? '/archive' : '/restore'),
        'PATCH',
      );
      setPublications((rows) =>
        rows?.map((entry) => (entry.itemId === row.itemId ? updated : entry)),
      );
      setNotice(
        archive ? 'Đã lưu trữ bài tri thức.' : 'Đã khôi phục bài tri thức.',
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Chưa cập nhật được trạng thái.',
      );
    } finally {
      setBusy(false);
    }
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
      {history ? (
        <>
          <Button variant="secondary" onClick={() => setHistory(undefined)}>
            Quay lại danh sách
          </Button>
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {history.versions.map((version) => (
              <li className="break-words p-3" key={version.id}>
                <Button
                  variant="secondary"
                  onClick={() => setVersionId(version.id)}
                >
                  Phiên bản {version.revision} · {version.title}
                </Button>
                <p className="mt-1 text-sm text-slate-600">
                  {date.format(new Date(version.updatedAt))}
                </p>
              </li>
            ))}
          </ul>
          {versionId && (
            <PublishedDetail
              key={versionId}
              path={
                publicationPath + '/' + history.itemId + '/history/' + versionId
              }
              request={editorRequest}
            />
          )}
        </>
      ) : !publications ? (
        !error && <p role="status">Đang tải bài tri thức…</p>
      ) : publications.length ? (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {publications.map((row) => (
            <li
              key={row.itemId}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0 break-words">
                <p className="font-semibold">{row.title}</p>
                <p className="text-sm text-slate-600">
                  {row.status === 'PUBLISHED' ? 'Đã xuất bản' : 'Lưu trữ'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void openHistory(row.itemId)}
                >
                  Xem lịch sử
                </Button>
                {onDraft && row.status === 'PUBLISHED' && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void revise(row)}
                  >
                    Sửa bài đã xuất bản
                  </Button>
                )}
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void change(row)}
                >
                  {row.status === 'PUBLISHED' ? 'Lưu trữ' : 'Khôi phục'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Chưa có bài tri thức đã xuất bản hoặc lưu trữ" />
      )}
    </section>
  );
}
