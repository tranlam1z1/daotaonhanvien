import { useState, type FormEvent } from 'react';
import { panel, Select } from '../training/TrainingFields';
import { Button, Input } from '../ui/controls';
import { DepartmentField } from './AssessmentFields';
import {
  defaultDepartment,
  groupLabel,
  saveAssessment,
  type Catalog,
  type Quiz,
} from './assessment-data';

export function QuizEditor({
  catalog,
  current,
  onSaved,
  onClose,
}: {
  catalog: Catalog;
  current?: Quiz;
  onSaved: (message: string) => Promise<void>;
  onClose: () => void;
}) {
  const [departmentId, setDepartmentId] = useState(
    current ? current.departmentId : defaultDepartment(catalog),
  );
  const [mode, setMode] = useState(current?.selectionMode ?? 'FIXED');
  const [selected, setSelected] = useState(
    current?.questions.map(({ questionId }) => questionId) ?? [],
  );
  const [keyword, setKeyword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const available = catalog.questions.filter(
    (question) => question.departmentId === departmentId,
  );
  const matching = available.filter((question) =>
    (question.prompt + ' ' + groupLabel(catalog, question))
      .toLocaleLowerCase('vi')
      .includes(keyword.trim().toLocaleLowerCase('vi')),
  );
  const selectedQuestions = selected.map((id) =>
    available.find((question) => question.id === id),
  );

  function move(index: number, other: number) {
    const reordered = [...selected];
    [reordered[index], reordered[other]] = [reordered[other], reordered[index]];
    setSelected(reordered);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = new FormData(event.currentTarget);
      await saveAssessment(
        '/quizzes',
        {
          departmentId,
          name: data.get('name'),
          selectionMode: mode,
          questionIds: selected,
          randomCount:
            mode === 'RANDOM' ? Number(data.get('randomCount')) : null,
          timeLimitMinutes: Number(data.get('timeLimitMinutes')),
          passingScore: Number(data.get('passingScore')),
          maxAttempts: Number(data.get('maxAttempts')),
          shuffleQuestions: data.has('shuffleQuestions'),
          shuffleOptions: data.has('shuffleOptions'),
          showAnswers: data.has('showAnswers'),
        },
        current?.id,
      );
      await onSaved('Đã lưu bài kiểm tra.');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Chưa thể lưu bài kiểm tra.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={panel} onSubmit={submit}>
      <h3 className="text-base font-semibold text-navy-900">
        {current ? 'Sửa bài kiểm tra' : 'Tạo bài kiểm tra'}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Tên bài kiểm tra"
          name="name"
          defaultValue={current?.name}
          maxLength={160}
          required
        />
        <DepartmentField
          catalog={catalog}
          value={departmentId}
          disabled={!!current}
          onChange={(id) => {
            setDepartmentId(id);
            setSelected([]);
          }}
        />
        <Select
          label="Cách chọn câu hỏi"
          value={mode}
          onChange={({ target }) =>
            setMode(target.value === 'RANDOM' ? 'RANDOM' : 'FIXED')
          }
        >
          <option value="FIXED">Danh sách cố định</option>
          <option value="RANDOM">Rút ngẫu nhiên</option>
        </Select>
        {mode === 'RANDOM' && (
          <Input
            label="Số câu rút ngẫu nhiên"
            name="randomCount"
            type="number"
            min={1}
            max={selected.length || 1}
            defaultValue={current?.randomCount ?? 1}
            required
          />
        )}
        <Input
          label="Thời gian làm bài (phút)"
          name="timeLimitMinutes"
          type="number"
          min={1}
          defaultValue={current?.timeLimitMinutes ?? ''}
          required
        />
        <Input
          label="Điểm đạt (%)"
          name="passingScore"
          type="number"
          min={0}
          max={100}
          defaultValue={current?.passingScore ?? catalog.defaults.passingScore}
          required
        />
        <Input
          label="Số lần làm tối đa"
          name="maxAttempts"
          type="number"
          min={1}
          defaultValue={current?.maxAttempts ?? catalog.defaults.maxAttempts}
          required
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-1 font-semibold text-navy-900">
          Tùy chọn làm bài
        </legend>
        {[
          {
            name: 'shuffleQuestions',
            label: 'Xáo trộn câu hỏi',
            checked: current?.shuffleQuestions,
          },
          {
            name: 'shuffleOptions',
            label: 'Xáo trộn phương án',
            checked: current?.shuffleOptions,
          },
          {
            name: 'showAnswers',
            label: 'Hiển thị đáp án sau khi nộp',
            checked: current?.showAnswers,
          },
        ].map(({ name, label, checked }) => (
          <label
            className="flex min-h-10 items-center gap-2 text-sm text-navy-900"
            key={name}
          >
            <input
              className="size-4"
              type="checkbox"
              name={name}
              defaultChecked={checked}
            />{' '}
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold text-navy-900">
          {mode === 'RANDOM'
            ? 'Nguồn câu hỏi để rút ngẫu nhiên'
            : 'Câu hỏi trong đề'}
        </legend>
        <Input
          label="Lọc câu hỏi theo nội dung, khóa học hoặc chủ đề"
          name="quizQuestionFilter"
          value={keyword}
          onChange={({ target }) => setKeyword(target.value)}
        />
        <div className="max-h-60 overflow-auto rounded-lg border border-slate-200 p-2">
          {matching.length === 0 && (
            <p className="p-2 text-sm text-slate-600">
              Chưa có câu hỏi phù hợp.
            </p>
          )}
          {matching.map((question) => (
            <label
              className="flex min-h-11 items-start gap-2 p-2 text-sm text-navy-900"
              key={question.id}
            >
              <input
                className="mt-0.5 size-4 shrink-0"
                type="checkbox"
                checked={selected.includes(question.id)}
                onChange={({ target }) =>
                  setSelected((ids) =>
                    target.checked
                      ? [...ids, question.id]
                      : ids.filter((id) => id !== question.id),
                  )
                }
              />
              <span className="min-w-0 break-words">
                {question.prompt} ·{' '}
                <span className="text-slate-600">
                  {groupLabel(catalog, question)}
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-sm text-slate-600">
          Đã chọn {selected.length} câu hỏi.
        </p>
        {mode === 'FIXED' && selectedQuestions.length > 0 && (
          <ol className="list-decimal space-y-2 pl-5 text-sm text-navy-900">
            {selectedQuestions.map(
              (question, index) =>
                question && (
                  <li key={question.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 break-words">
                        {question.prompt}
                      </span>
                      <Button
                        variant="secondary"
                        aria-label={'Đưa câu ' + (index + 1) + ' lên'}
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                      >
                        Lên
                      </Button>
                      <Button
                        variant="secondary"
                        aria-label={'Đưa câu ' + (index + 1) + ' xuống'}
                        disabled={index === selected.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        Xuống
                      </Button>
                    </div>
                  </li>
                ),
            )}
          </ol>
        )}
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || selected.length === 0}>
          Lưu bài kiểm tra
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          Đóng biểu mẫu
        </Button>
      </div>
    </form>
  );
}
