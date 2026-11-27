'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { accountError, apiUrl } from '../../lib/account-api';
import { Button, Input } from '../ui/controls';
import { panel, Select, TextArea } from './TrainingFields';
import {
  newTemplateProgram,
  TemplateProgramEditor,
  type TemplateProgram,
} from './TemplateProgramEditor';

import {
  TemplateQuestionEditor,
  type TemplateQuestion,
} from './TemplateQuestionEditor';

type Release = {
  version: string;
  industry: string;
  positionGroup: string;
  notes: string;
  program: TemplateProgram;
  questions: TemplateQuestion[];
};

const endpoint = apiUrl + '/training/templates';

export function PlatformTemplates() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [selected, setSelected] = useState('none');
  const [industry, setIndustry] = useState('');
  const [positionGroup, setPositionGroup] = useState('');
  const [notes, setNotes] = useState('');
  const [program, setProgram] = useState<TemplateProgram | null>(null);
  const [questions, setQuestions] = useState<TemplateQuestion[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    void fetch(endpoint + '/platform/releases', {
      credentials: 'include',
      signal: abort.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await accountError(response));
        setReleases((await response.json()) as Release[]);
      })
      .catch((failure: Error) => {
        if (!abort.signal.aborted) setError(failure.message);
      });
    return () => abort.abort();
  }, []);

  function choose(id: string) {
    const release = releases.find((item) => item.program.id === id);
    setSelected(id);
    setIndustry(release?.industry ?? '');
    setPositionGroup(release?.positionGroup ?? '');
    setNotes('');
    setProgram(release?.program ?? (id === '' ? newTemplateProgram() : null));
    setQuestions(release?.questions ?? []);
    setMessage('');
    setError('');
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (!program) return;
      const response = await fetch(endpoint + '/releases', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry,
          positionGroup,
          notes,
          program,
          questions,
        }),
      });
      if (!response.ok) throw new Error(await accountError(response));
      const release = (await response.json()) as Release;
      setReleases((items) => [
        ...items.filter((item) => item.program.id !== release.program.id),
        release,
      ]);
      setSelected(release.program.id);
      setNotes('');
      setMessage('Đã phát hành bộ mẫu ' + release.program.name + '.');
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Chưa thể phát hành bộ mẫu.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={panel} onSubmit={(event) => void publish(event)}>
      <fieldset className="min-w-0 space-y-4" disabled={busy}>
        <Select
          label="Bộ mẫu hiện có"
          value={selected}
          onChange={(event) => choose(event.target.value)}
        >
          <option value="none">Chọn bộ mẫu</option>
          <option value="">Tạo bộ mẫu mới</option>
          {releases.map((release) => (
            <option key={release.program.id} value={release.program.id}>
              {release.program.name}
            </option>
          ))}
        </Select>
        {program && (
          <>
            <Input
              name="industry"
              label="Ngành nghề"
              required
              maxLength={200}
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
            />
            <Input
              name="position-group"
              label="Nhóm vị trí"
              required
              maxLength={200}
              value={positionGroup}
              onChange={(event) => setPositionGroup(event.target.value)}
            />
            <TemplateProgramEditor value={program} onChange={setProgram} />
            <TemplateQuestionEditor
              questions={questions}
              onChange={setQuestions}
            />
            <TextArea
              label="Ghi chú thay đổi"
              required
              maxLength={5000}
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            <Button type="submit">Phát hành phiên bản</Button>
          </>
        )}
      </fieldset>
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
    </form>
  );
}
