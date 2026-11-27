import { useState, type FormEvent } from 'react';
import { accountError } from '../../lib/account-api';
import { panel, Select, TextArea } from '../training/TrainingFields';
import { Button, Input } from '../ui/controls';
import { QuestionGroupFields } from './AssessmentFields';
import {
  defaultDepartment,
  endpoint,
  questionTypes,
  saveAssessment,
  trueFalseOptions,
  type Catalog,
  type Question,
  type QuestionType,
} from './assessment-data';

type FormProps = {
  catalog: Catalog;
  onSaved: (message: string) => Promise<void>;
  onClose: () => void;
};

export function QuestionEditor({
  catalog,
  current,
  onSaved,
  onClose,
}: FormProps & {
  current?: Question;
}) {
  const [group, setGroup] = useState({
    departmentId: defaultDepartment(catalog),
    courseId: null as string | null,
    topic: '',
  });
  const [type, setType] = useState<QuestionType>(
    current?.type ?? 'SINGLE_CHOICE',
  );
  const [options, setOptions] = useState(
    current && current.type !== 'TRUE_FALSE' ? current.options : ['', ''],
  );
  const [correct, setCorrect] = useState(current?.correctOptions ?? []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = new FormData(event.currentTarget);
      await saveAssessment(
        '/questions',
        {
          ...group,
          type,
          prompt: data.get('prompt'),
          options: type === 'TRUE_FALSE' ? trueFalseOptions : options,
          correctOptions: correct,
          explanation: data.get('explanation'),
        },
        current?.id,
      );
      await onSaved('Đã lưu câu hỏi.');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Chưa thể lưu câu hỏi.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={panel} onSubmit={submit}>
      <h3 className="text-base font-semibold text-navy-900">
        {current ? 'Sửa câu hỏi' : 'Tạo câu hỏi'}
      </h3>
      {!current && (
        <QuestionGroupFields
          catalog={catalog}
          value={group}
          onChange={setGroup}
        />
      )}
      <Select
        label="Loại câu hỏi"
        value={type}
        onChange={({ target }) => {
          setType(target.value as QuestionType);
          setCorrect([]);
        }}
      >
        {Object.entries(questionTypes).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <TextArea
        label="Câu hỏi"
        name="prompt"
        defaultValue={current?.prompt}
        maxLength={3000}
        required
      />
      {type === 'TRUE_FALSE' ? (
        <Select
          label="Đáp án đúng"
          value={correct[0] ?? ''}
          required
          onChange={({ target }) =>
            setCorrect(target.value ? [Number(target.value)] : [])
          }
        >
          <option value="">Chọn đáp án</option>
          <option value="1">Đúng</option>
          <option value="2">Sai</option>
        </Select>
      ) : (
        <fieldset className="space-y-2">
          <legend className="mb-2 font-semibold text-navy-900">
            Phương án và đáp án đúng
          </legend>
          {options.map((option, index) => {
            const position = index + 1;
            return (
              <div className="flex flex-wrap items-end gap-2" key={position}>
                <div className="min-w-0 grow">
                  <Input
                    label={'Phương án ' + position}
                    name={'option-' + position}
                    required
                    maxLength={1000}
                    value={option}
                    onChange={({ target: { value } }) =>
                      setOptions((previous) =>
                        previous.map((entry, previousIndex) =>
                          previousIndex === index ? value : entry,
                        ),
                      )
                    }
                  />
                </div>
                <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-navy-900">
                  <input
                    type={type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'}
                    name="correctOption"
                    className="size-4"
                    aria-label={'Đáp án đúng ' + position}
                    checked={correct.includes(position)}
                    onChange={({ target: { checked } }) =>
                      setCorrect((previous) =>
                        type === 'SINGLE_CHOICE'
                          ? [position]
                          : checked
                            ? [...previous, position]
                            : previous.filter((value) => value !== position),
                      )
                    }
                  />
                  Đáp án đúng
                </label>
                <Button
                  variant="secondary"
                  disabled={options.length <= 2}
                  aria-label={'Xóa phương án ' + position}
                  onClick={() => {
                    setOptions((previous) =>
                      previous.filter(
                        (_, optionIndex) => optionIndex !== index,
                      ),
                    );
                    setCorrect((previous) =>
                      previous
                        .filter((value) => value !== position)
                        .map((value) => (value > position ? value - 1 : value)),
                    );
                  }}
                >
                  Xóa
                </Button>
              </div>
            );
          })}
          <Button
            variant="secondary"
            disabled={options.length >= 20}
            onClick={() => setOptions((previous) => [...previous, ''])}
          >
            Thêm phương án
          </Button>
        </fieldset>
      )}
      <TextArea
        label="Giải thích đáp án"
        name="explanation"
        defaultValue={current?.explanation}
        maxLength={3000}
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          Lưu câu hỏi
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Đóng biểu mẫu
        </Button>
      </div>
    </form>
  );
}

export function QuestionImport({ catalog, onSaved, onClose }: FormProps) {
  const [group, setGroup] = useState({
    departmentId: defaultDepartment(catalog),
    courseId: null as string | null,
    topic: '',
  });
  const [error, setError] = useState('');
  const [rowErrors, setRowErrors] = useState<
    { row: number; message: string }[]
  >([]);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setRowErrors([]);
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const { departmentId, courseId, topic } = group;
    const query = new URLSearchParams({
      departmentId: departmentId ?? '',
      courseId: courseId ?? '',
      topic,
    });
    try {
      const response = await fetch(endpoint + '/questions/import?' + query, {
        credentials: 'include',
        method: 'POST',
        body: data,
      });
      if (!response.ok) {
        const details = await response
          .clone()
          .json()
          .catch(() => null);
        if (Array.isArray(details?.errors)) setRowErrors(details.errors);
        throw new Error(await accountError(response));
      }
      const { count } = (await response.json()) as { count: number };
      await onSaved('Đã nhập ' + count + ' câu hỏi.');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Chưa thể nhập câu hỏi.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={panel} onSubmit={submit}>
      <h3 className="text-base font-semibold text-navy-900">
        Nhập câu hỏi từ Excel
      </h3>
      <a
        className="inline-block font-semibold text-brand-blue underline"
        href={endpoint + '/questions/template'}
      >
        Tải tệp mẫu
      </a>
      <QuestionGroupFields
        catalog={catalog}
        value={group}
        onChange={setGroup}
      />
      <Input
        label="Tệp Excel .xlsx"
        name="file"
        type="file"
        accept=".xlsx"
        required
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {rowErrors.length > 0 && (
        <ul className="max-h-32 list-inside list-disc overflow-auto text-sm text-red-700">
          {rowErrors.map(({ row, message }) => (
            <li key={row}>
              Dòng {row}: {message}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          Nhập câu hỏi
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Đóng biểu mẫu
        </Button>
      </div>
    </form>
  );
}
