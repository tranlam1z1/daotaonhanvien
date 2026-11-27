'use client';

import { useState, type FormEvent } from 'react';
import { accountError, apiUrl } from '../../lib/account-api';
import { Button } from '../ui/controls';
import { panel, Scope, Select } from './TrainingFields';
import type { Editor, Label } from './training-data';

type Release = {
  version: string;
  program: Label & {
    courses: (Label & { modules: (Label & { lessons: Label[] })[] })[];
  };
};
type CopyResult = { programId: string | null; courseIds: string[] };
const endpoint = apiUrl + '/training/templates';

async function readResponse<T>(response: Response) {
  if (!response.ok) throw new Error(await accountError(response));
  return response.json() as Promise<T>;
}

function options({ program }: Release) {
  return [
    { key: 'program/' + program.id, label: 'Chương trình · ' + program.name },
    ...program.courses.flatMap((course) => [
      { key: 'course/' + course.id, label: 'Khóa học · ' + course.name },
      ...course.modules.flatMap((module) => [
        { key: 'module/' + module.id, label: 'Module · ' + module.name },
        ...module.lessons.map((lesson) => ({
          key: 'lesson/' + lesson.id,
          label: 'Bài học · ' + lesson.name,
        })),
      ]),
    ]),
  ];
}

export function TemplateLibrary({
  catalog,
  onCopied,
}: {
  catalog: Editor;
  onCopied: (result: CopyResult) => void | Promise<void>;
}) {
  const [release, setRelease] = useState<Release | null>(null);
  const [selection, setSelection] = useState('');
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setError('');
    setBusy(true);
    try {
      setRelease(
        await readResponse<Release>(
          await fetch(endpoint, { credentials: 'include' }),
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Chưa thể mở thư viện bộ mẫu.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function copy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const result = await readResponse<CopyResult>(
        await fetch(endpoint + '/' + selection + '/copy', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ departmentId }),
        }),
      );
      setMessage('Đã tạo bản nháp từ bộ mẫu.');
      await onCopied(result);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Chưa thể sao chép bộ mẫu.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={panel}>
      <h2 className="text-lg font-semibold text-navy-900">Thư viện bộ mẫu</h2>
      {release ? (
        <form className="space-y-4" onSubmit={copy}>
          <Select
            label="Mục mẫu đã phát hành"
            value={selection}
            required
            onChange={(event) => setSelection(event.target.value)}
          >
            <option value="">Chọn mục mẫu</option>
            {options(release).map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          <Scope
            catalog={catalog}
            value={departmentId}
            onChange={setDepartmentId}
          />
          <Button type="submit" disabled={busy || !selection}>
            Sao chép thành bản nháp
          </Button>
        </form>
      ) : (
        <Button variant="secondary" disabled={busy} onClick={() => void load()}>
          Mở thư viện
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-teal-700">
          {message}
        </p>
      )}
    </section>
  );
}
