'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Button, EmptyState } from '../ui/controls';
import { KnowledgeCatalog } from './KnowledgeCatalog';
import { KnowledgeDraft } from './KnowledgeDraft';
import {
  audienceLabels,
  categoryPaths,
  editorRequest,
  type Draft,
  type EditorData,
} from './knowledge-data';

import { KnowledgePublications } from './KnowledgePublications';

type View =
  | { mode: 'list' | 'pending' | 'catalog' | 'new' | 'publications' }
  | { mode: 'preview' | 'edit'; draft: Draft };

export function Knowledge() {
  const [data, setData] = useState<EditorData>();
  const [view, setView] = useState<View>({ mode: 'list' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let alive = true;
    void editorRequest<EditorData>()
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((failure: Error) => {
        if (alive) setError(failure.message);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function refresh() {
    setData(await editorRequest<EditorData>());
  }

  async function open(path: string, mode: 'preview' | 'edit') {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      setView({ mode, draft: await editorRequest<Draft>(path) });
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Chưa mở được bản nháp.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function act(draft: Draft, action: 'submit' | 'withdraw' | 'publish') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await editorRequest<Draft>(
        '/versions/' + draft.id + '/' + action,
        'POST',
        action === 'withdraw' ? { token: draft.reviewToken } : undefined,
      );
      setView(
        updated.status === 'PUBLISHED'
          ? { mode: 'publications' }
          : { mode: 'preview', draft: updated },
      );
      setNotice(
        {
          submit: 'Đã gửi duyệt.',
          withdraw: 'Đã rút lại về bản nháp.',
          publish: 'Đã xuất bản bài tri thức.',
        }[action],
      );
      await refresh();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Chưa cập nhật được phiên bản.',
      );
    } finally {
      setBusy(false);
    }
  }

  function saved(draft: Draft) {
    setView({ mode: 'preview', draft });
    setNotice('Đã lưu bản nháp.');
    void refresh().catch((failure: Error) => setError(failure.message));
  }

  async function download(draft: Draft, fileId: string) {
    setError('');
    try {
      const source =
        draft.status === 'IN_REVIEW'
          ? '/submissions/' + draft.id
          : '/drafts/' + draft.itemId;
      const path = source + '/files/' + fileId;
      const { url } = await editorRequest<{ url: string }>(path);
      window.location.assign(url);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Chưa tải được tệp.',
      );
    }
  }

  if (!data)
    return error ? (
      <p role="alert">{error}</p>
    ) : (
      <p role="status">Đang tải bản nháp…</p>
    );

  const rows = view.mode === 'pending' ? data.pending : data.drafts;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={view.mode === 'list' ? 'primary' : 'secondary'}
          disabled={busy}
          onClick={() => {
            setView({ mode: 'list' });
            setError('');
            setNotice('');
          }}
        >
          Bản nháp
        </Button>
        <Button
          variant={view.mode === 'pending' ? 'primary' : 'secondary'}
          disabled={busy}
          onClick={() => {
            setView({ mode: 'pending' });
            setError('');
            setNotice('');
          }}
        >
          Chờ duyệt
        </Button>
        <Button
          variant={view.mode === 'publications' ? 'primary' : 'secondary'}
          disabled={busy}
          onClick={() => {
            setView({ mode: 'publications' });
            setError('');
            setNotice('');
          }}
        >
          Đã xuất bản và lưu trữ
        </Button>
        {data.manageTaxonomy && (
          <Button
            variant={view.mode === 'catalog' ? 'primary' : 'secondary'}
            disabled={busy}
            onClick={() => {
              setView({ mode: 'catalog' });
              setError('');
              setNotice('');
            }}
          >
            Danh mục và thẻ
          </Button>
        )}
        {view.mode === 'list' && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setView({ mode: 'new' });
              setError('');
            }}
          >
            Soạn bản nháp
          </Button>
        )}
      </div>
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
      {view.mode === 'publications' && (
        <KnowledgePublications
          onDraft={(draft) => {
            setView({ mode: 'edit', draft });
            setNotice('Đã tạo bản nháp mới từ phiên bản xuất bản.');
            void refresh().catch((failure: Error) => setError(failure.message));
          }}
        />
      )}
      {view.mode === 'catalog' && (
        <KnowledgeCatalog data={data} onChange={refresh} />
      )}
      {(view.mode === 'list' || view.mode === 'pending') &&
        (rows.length ? (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {rows.map(
              ({ id, itemId, title, audience, status, rejectionReason }) => (
                <li
                  key={itemId}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0 break-words">
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm text-slate-600">
                      {audienceLabels[audience]}
                    </p>
                    {rejectionReason && (
                      <p className="text-sm text-red-700">Đã bị từ chối</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void open(
                          status === 'IN_REVIEW'
                            ? '/submissions/' + id
                            : '/drafts/' + itemId,
                          'preview',
                        )
                      }
                    >
                      Xem trước
                    </Button>
                    {status === 'DRAFT' && (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void open('/drafts/' + itemId, 'edit')}
                      >
                        Sửa
                      </Button>
                    )}
                  </div>
                </li>
              ),
            )}
          </ul>
        ) : (
          <EmptyState
            title={
              view.mode === 'pending'
                ? 'Chưa có phiên bản chờ duyệt'
                : 'Chưa có bản nháp tri thức'
            }
          />
        ))}
      {(view.mode === 'new' || view.mode === 'edit') && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-bold">
            {view.mode === 'new' ? 'Soạn bản nháp' : 'Sửa bản nháp'}
          </h2>
          <KnowledgeDraft
            key={view.mode === 'edit' ? view.draft.itemId : 'new'}
            initial={view.mode === 'edit' ? view.draft : undefined}
            data={data}
            onSave={saved}
          />
        </section>
      )}
      {view.mode === 'preview' && (
        <KnowledgePreview
          draft={view.draft}
          data={data}
          onDownload={(fileId) => void download(view.draft, fileId)}
        >
          <div className="flex flex-wrap gap-2">
            {view.draft.status === 'DRAFT' && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setView({ mode: 'edit', draft: view.draft });
                  setNotice('');
                }}
              >
                Sửa bản nháp
              </Button>
            )}
            {view.draft.canSubmit && (
              <Button
                disabled={busy}
                onClick={() => void act(view.draft, 'submit')}
              >
                Gửi duyệt
              </Button>
            )}
            {view.draft.canPublish && (
              <Button
                disabled={busy}
                onClick={() => void act(view.draft, 'publish')}
              >
                Xuất bản
              </Button>
            )}
            {view.draft.canWithdraw && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void act(view.draft, 'withdraw')}
              >
                Rút lại
              </Button>
            )}
          </div>
        </KnowledgePreview>
      )}
    </div>
  );
}

export function KnowledgePreview({
  draft,
  data,
  onDownload,
  children,
}: {
  draft: Draft;
  data?: EditorData;
  onDownload: (fileId: string) => void;
  children?: ReactNode;
}) {
  const category = categoryPaths(data?.categories ?? []).find(
    ({ id }) => id === draft.categoryId,
  )?.label;
  const tags = (data?.tags ?? [])
    .filter(({ id }) => draft.tagIds.includes(id))
    .map(({ name }) => name);
  const audience =
    draft.audience === 'DEPARTMENTS'
      ? data?.departments.filter(({ id }) => draft.departmentIds.includes(id))
      : data?.positions.filter(({ id }) => draft.positionIds.includes(id));
  const scopeLabels =
    draft.scopeLabels ?? audience?.map(({ name }) => name) ?? [];
  return (
    <article className="space-y-4 break-words rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <p className="text-sm font-semibold text-blue-700">
        {draft.status === 'IN_REVIEW'
          ? 'Xem trước bản chờ duyệt'
          : 'Xem trước bản nháp'}
      </p>
      <h2 className="min-w-0 text-xl font-bold">{draft.title}</h2>
      {draft.rejectionReason && (
        <p className="whitespace-pre-wrap text-sm text-red-700">
          Lý do từ chối · {draft.rejectionReason}
        </p>
      )}
      {draft.summary && <p>{draft.summary}</p>}
      <div
        className="knowledge-rich"
        dangerouslySetInnerHTML={{ __html: draft.bodyHtml }}
      />
      <dl className="space-y-2 border-t border-slate-200 pt-3 text-sm">
        {category && (
          <div>
            <dt className="font-semibold">Danh mục</dt>
            <dd>{category}</dd>
          </div>
        )}
        {tags.length > 0 && (
          <div>
            <dt className="font-semibold">Thẻ</dt>
            <dd>{tags.join(', ')}</dd>
          </div>
        )}
        <div>
          <dt className="font-semibold">Phạm vi truy cập</dt>
          <dd>
            {audienceLabels[draft.audience]}
            {scopeLabels.length > 0 && ' · ' + scopeLabels.join(', ')}
          </dd>
        </div>
      </dl>
      {draft.attachments.map(({ file, video }) => (
        <div key={file.id}>
          <Button
            variant="secondary"
            className="max-w-full text-left break-words"
            onClick={() => onDownload(file.id)}
          >
            {video ? 'Tải video' : 'Tải tệp'} · {file.name}
          </Button>
        </div>
      ))}
      {draft.videoUrl && (
        <a
          className="inline-flex min-h-11 items-center font-semibold text-blue-700 underline"
          href={draft.videoUrl}
          target="_blank"
          rel="noreferrer"
        >
          Mở liên kết video
        </a>
      )}
      {children}
    </article>
  );
}
