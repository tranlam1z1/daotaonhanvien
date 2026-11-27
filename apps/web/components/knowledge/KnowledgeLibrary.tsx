'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button, EmptyState } from '../ui/controls';
import {
  categoryPaths,
  inputStyle,
  readerRequest,
  type Category,
  type Label,
  type PublishedArticle,
} from './knowledge-data';
import { PublishedDetail } from './PublishedDetail';

type Results = {
  articles: PublishedArticle[];
  categories: Category[];
  tags: Label[];
  departments: Label[];
};

export function KnowledgeLibrary() {
  const [query, setQuery] = useState({ search: '', revision: 0 });
  const [results, setResults] = useState<Results>();
  const [article, setArticle] = useState<PublishedArticle>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void readerRequest<Results>(query.search, controller.signal)
      .then(setResults)
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [query]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    new FormData(event.currentTarget).forEach((value, key) => {
      if (typeof value === 'string' && value.trim())
        params.set(key, value.trim());
    });
    setError('');
    setBusy(true);
    setQuery(({ revision }) => ({
      search: params.size ? '?' + params.toString() : '',
      revision: revision + 1,
    }));
  }

  return (
    <div className="space-y-4">
      <form
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
        hidden={!!article}
        onSubmit={search}
      >
        <label className="block text-sm font-semibold">
          Từ khóa
          <input
            className={inputStyle}
            name="q"
            maxLength={200}
            placeholder="Tìm trong bài viết và tệp PDF, Word"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <Filter
            name="categoryId"
            label="Danh mục"
            options={categoryPaths(results?.categories ?? []).map(
              ({ id, label }) => ({ id, name: label }),
            )}
          />
          <Filter name="tagId" label="Thẻ" options={results?.tags ?? []} />
          <Filter
            name="departmentId"
            label="Phòng ban"
            options={results?.departments ?? []}
          />
        </div>
        <Button type="submit" disabled={busy}>
          Tìm kiếm
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {article ? (
        <>
          <Button
            variant="secondary"
            onClick={() => {
              setArticle(undefined);
              setBusy(true);
              setError('');
              setQuery((value) => ({ ...value, revision: value.revision + 1 }));
            }}
          >
            Quay lại kết quả
          </Button>
          <PublishedDetail
            key={article.itemId}
            path={'/' + article.itemId}
            request={readerRequest}
          />
        </>
      ) : busy ? (
        <p role="status">Đang tra cứu…</p>
      ) : results?.articles.length ? (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {results.articles.map((entry) => (
            <li key={entry.itemId} className="space-y-1 break-words p-4">
              <button
                type="button"
                className="min-h-11 text-left font-semibold text-blue-700 underline"
                onClick={() => setArticle(entry)}
              >
                {entry.title}
              </button>
              {entry.summary && (
                <p className="text-sm text-slate-700">{entry.summary}</p>
              )}
            </li>
          ))}
        </ul>
      ) : results && !error ? (
        <EmptyState title="Không tìm thấy bài tri thức" />
      ) : null}
    </div>
  );
}

function Filter({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: Label[];
}) {
  return (
    <label className="block min-w-0 text-sm font-semibold">
      {label}
      <select name={name} className={inputStyle}>
        <option value="">Tất cả</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
