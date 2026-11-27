'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button, Input } from '../ui/controls';
import { learningRequest } from './learning-api';

const criteria = ['content', 'usefulness', 'length'] as const;
type Template = Record<(typeof criteria)[number] | 'feedback', string>;
const labels: Template = {
  content: 'Nội dung khóa học',
  usefulness: 'Mức độ áp dụng',
  length: 'Độ dài khóa học',
  feedback: 'Góp ý',
};
const panel = 'space-y-3 rounded-xl border border-slate-200 bg-white p-4';

export function SurveyTemplate() {
  const [template, setTemplate] = useState<Template>();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void learningRequest<Template>('/survey/template', {
      signal: controller.signal,
    })
      .then(setTemplate)
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    setStatus('');
    try {
      setTemplate(
        await learningRequest<Template>('/survey/template', {
          post: true,
          body,
        }),
      );
      setStatus('Đã lưu mẫu khảo sát.');
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={panel}>
      <h2 className="font-semibold">Mẫu khảo sát mặc định</h2>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {template && (
        <form onSubmit={(event) => void save(event)} className="space-y-3">
          {([...criteria, 'feedback'] as const).map((name) => (
            <Input
              key={name}
              name={name}
              label={labels[name]}
              defaultValue={template[name]}
              maxLength={200}
              required
            />
          ))}
          <Button type="submit" disabled={busy}>
            Lưu mẫu khảo sát
          </Button>
        </form>
      )}
    </section>
  );
}

export function CourseSurvey({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [survey, setSurvey] = useState<{
    template: Template;
    submitted: boolean;
  }>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const path = '/' + id + '/survey';
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void learningRequest<{ template: Template; submitted: boolean }>(path, {
      signal: controller.signal,
    })
      .then(setSurvey)
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [open, path]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ratings = Object.fromEntries(
      criteria.map((name) => [name, Number(data.get(name))]),
    );
    setBusy(true);
    setError('');
    try {
      await learningRequest(path, {
        post: true,
        body: { ratings, feedback: data.get('feedback') },
      });
      setSurvey((state) => state && { ...state, submitted: true });
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={panel}>
      <h3 className="font-semibold">Khảo sát chất lượng khóa học</h3>
      {!open && (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Mở khảo sát tùy chọn
        </Button>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {open && !survey && !error && <p role="status">Đang tải khảo sát…</p>}
      {survey?.submitted && <p role="status">Đã gửi đánh giá.</p>}
      {survey && !survey.submitted && (
        <form onSubmit={(event) => void submit(event)} className="space-y-3">
          <p className="text-sm">Chọn từ 1 (thấp nhất) đến 5 (cao nhất).</p>
          {criteria.map((name) => (
            <label key={name} className="block break-words">
              {survey.template[name]}
              <select
                name={name}
                className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 p-2"
                defaultValue=""
                required
              >
                <option value="">Chọn mức</option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="block break-words">
            {survey.template.feedback}
            <textarea
              name="feedback"
              maxLength={3000}
              rows={3}
              className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
            />
          </label>
          <Button type="submit" disabled={busy}>
            Gửi đánh giá
          </Button>
        </form>
      )}
    </section>
  );
}
