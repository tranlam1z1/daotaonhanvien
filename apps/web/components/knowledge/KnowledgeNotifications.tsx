'use client';

import { useEffect, useState } from 'react';
import { trainingApi } from '../training/training-data';
import { EmptyState } from '../ui/controls';
import { rejectionRequest } from './knowledge-data';

type Rejection = {
  id: string;
  title: string;
  reason: string;
  createdAt: string;
};

const date = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Ho_Chi_Minh',
});

export function KnowledgeNotifications() {
  const [items, setItems] =
    useState<(Rejection & { contentType: 'tri thức' | 'đào tạo' })[]>();
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      rejectionRequest<Rejection[]>(controller.signal),
      trainingApi<Rejection[]>(
        '/rejections',
        'GET',
        undefined,
        controller.signal,
      ),
    ])
      .then(([knowledge, training]) =>
        setItems(
          [
            ...knowledge.map((item) => ({
              ...item,
              contentType: 'tri thức' as const,
            })),
            ...training.map((item) => ({
              ...item,
              contentType: 'đào tạo' as const,
            })),
          ].sort((left, right) =>
            right.createdAt.localeCompare(left.createdAt),
          ),
        ),
      )
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!items) return <p role="status">Đang tải thông báo…</p>;
  if (!items.length) return <EmptyState title="Chưa có thông báo" />;

  return (
    <ul className="divide-y divide-slate-200">
      {items.map((item) => (
        <li
          key={item.contentType + item.id}
          className="space-y-1 break-words py-3"
        >
          <p className="text-sm font-semibold">
            Nội dung {item.contentType} bị từ chối · {item.title}
          </p>
          <p className="whitespace-pre-wrap text-sm">{item.reason}</p>
          <time dateTime={item.createdAt} className="text-sm text-slate-600">
            {date.format(new Date(item.createdAt))}
          </time>
        </li>
      ))}
    </ul>
  );
}
