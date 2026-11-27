'use client';

import { useState } from 'react';
import { accountError, apiUrl } from '../../lib/account-api';
import { Button } from '../ui/controls';
import { panel, Select } from './TrainingFields';
import type { Editor } from './training-data';

type Content = {
  name: string;
  description?: string;
  durationMinutes?: number;
  body?: string | null;
  videoUrl?: string | null;
  modules?: Content[];
  lessons?: Content[];
};
type Change = {
  id: string;
  level: 'course' | 'module' | 'lesson';
  name: string;
  notes: string;
  version: string;
  customized: boolean;
  current: Content;
  proposed: Content;
};
type Comparison = { revision: number; changes: Change[] };
const labels = { course: 'Khóa học', module: 'Module', lesson: 'Bài học' };

function ContentPreview({ content }: { content: Content }) {
  return (
    <div className="space-y-1 break-words text-sm">
      <p className="font-medium">{content.name}</p>
      {content.durationMinutes && <p>{content.durationMinutes} phút</p>}
      {(content.description || content.body || content.videoUrl) && (
        <p className="whitespace-pre-wrap">
          {content.description || content.body || content.videoUrl}
        </p>
      )}
      {(content.modules ?? content.lessons ?? []).map((entry, position) => (
        <div key={position} className="border-l border-slate-200 pl-3">
          <ContentPreview content={entry} />
        </div>
      ))}
    </div>
  );
}

export function TemplateUpdates({
  catalog,
  onApplied,
}: {
  catalog: Editor;
  onApplied: () => Promise<void>;
}) {
  const [courseId, setCourseId] = useState('');
  const [comparison, setComparison] = useState<Comparison>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const url = apiUrl + '/training/templates/updates/' + courseId;

  async function request(
    change?: Change,
    action?: 'keep' | 'replace' | 'copy',
  ) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (change && action) {
        const write = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: change.id,
            level: change.level,
            version: change.version,
            revision: comparison?.revision,
            action,
          }),
        });
        if (!write.ok) throw new Error(await accountError(write));
        setMessage(
          action === 'keep'
            ? 'Đã giữ nội dung hiện tại.'
            : 'Đã lưu bản nháp để gửi duyệt.',
        );
        if (action !== 'keep') await onApplied();
      }
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error(await accountError(response));
      setComparison((await response.json()) as Comparison);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Chưa thể kiểm tra cập nhật.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={panel}>
      <h2 className="text-lg font-semibold text-navy-900">
        Cập nhật từ bộ mẫu
      </h2>
      <Select
        label="Khóa học"
        value={courseId}
        disabled={busy}
        onChange={(event) => {
          setCourseId(event.target.value);
          setComparison(undefined);
          setMessage('');
          setError('');
        }}
      >
        <option value="">Chọn khóa học</option>
        {catalog.courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.name}
          </option>
        ))}
      </Select>
      <Button
        variant="secondary"
        disabled={busy || !courseId}
        onClick={() => void request()}
      >
        Kiểm tra cập nhật
      </Button>
      {comparison?.changes.length === 0 && (
        <p>Chưa có bản cập nhật cho khóa học này.</p>
      )}
      {comparison?.changes.map((change) => (
        <details
          key={change.id}
          className="rounded-lg border border-slate-200 p-3"
        >
          <summary className="cursor-pointer font-medium">
            {labels[change.level]} · {change.name}
            {change.customized && ' · Đã tùy chỉnh'}
          </summary>
          <p className="my-3 whitespace-pre-wrap text-sm">{change.notes}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold">Bản hiện tại</h3>
              <ContentPreview content={change.current} />
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Bản mẫu mới</h3>
              <ContentPreview content={change.proposed} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void request(change, 'keep')}
            >
              Giữ
            </Button>
            <Button
              disabled={busy}
              onClick={() => void request(change, 'replace')}
            >
              Thay
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void request(change, 'copy')}
            >
              Tạo bản sao
            </Button>
          </div>
        </details>
      ))}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-teal-700">
          {message}
        </p>
      )}
    </section>
  );
}
