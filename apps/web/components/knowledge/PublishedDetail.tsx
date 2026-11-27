'use client';

import { useEffect, useState } from 'react';
import { Button } from '../ui/controls';
import type { Attachment, PublishedArticle } from './knowledge-data';

type ArticleDetail = PublishedArticle & {
  bodyHtml: string;
  videoUrl: string | null;
  attachments: Attachment[];
};

export function PublishedDetail({
  path,
  request,
}: {
  path: string;
  request: <T>(path: string) => Promise<T>;
}) {
  const [article, setArticle] = useState<ArticleDetail>();
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    void request<ArticleDetail>(path)
      .then((result) => {
        if (active) setArticle(result);
      })
      .catch((failure: Error) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, [path, request]);

  async function download(fileId: string) {
    setDownloading(true);
    setError('');
    try {
      const { url } = await request<{ url: string }>(path + '/files/' + fileId);
      window.location.assign(url);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Chưa tải được tệp.',
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <article className="space-y-4 break-words rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {!article && !error && <p role="status">Đang tải bài tri thức…</p>}
      {article && (
        <>
          <h2 className="text-xl font-bold">{article.title}</h2>
          {article.summary && <p>{article.summary}</p>}
          <div
            className="knowledge-rich"
            dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
          />
          {article.attachments.map(({ file, video }) => (
            <div key={file.id}>
              <Button
                variant="secondary"
                disabled={downloading}
                onClick={() => void download(file.id)}
              >
                {video ? 'Tải video' : 'Tải tệp'} · {file.name}
              </Button>
            </div>
          ))}
          {article.videoUrl && (
            <a
              className="inline-flex min-h-11 items-center font-semibold text-blue-700 underline"
              href={article.videoUrl}
              rel="noreferrer"
              target="_blank"
            >
              Mở liên kết video
            </a>
          )}
        </>
      )}
    </article>
  );
}
