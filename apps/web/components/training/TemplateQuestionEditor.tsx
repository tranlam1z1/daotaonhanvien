'use client';

import { Button, Input } from '../ui/controls';
import { Select, TextArea } from './TrainingFields';

export type TemplateQuestion = {
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  prompt: string;
  options: string[];
  correctOptions: number[];
  explanation: string;
};

const labels = {
  SINGLE_CHOICE: 'Một đáp án đúng',
  MULTIPLE_CHOICE: 'Nhiều đáp án đúng',
  TRUE_FALSE: 'Đúng hoặc sai',
};

export function TemplateQuestionEditor({
  questions,
  onChange,
}: {
  questions: TemplateQuestion[];
  onChange: (questions: TemplateQuestion[]) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-navy-900">Ngân hàng câu hỏi mẫu</h2>
      {questions.map((question, index) => {
        const update = (changes: Partial<TemplateQuestion>) =>
          onChange(
            questions.map((item, position) =>
              position === index ? { ...item, ...changes } : item,
            ),
          );
        const options =
          question.type === 'TRUE_FALSE' ? ['Đúng', 'Sai'] : question.options;
        return (
          <fieldset
            key={index}
            className="min-w-0 space-y-3 rounded-lg border border-slate-200 p-3"
          >
            <legend className="px-1 font-medium">Câu hỏi {index + 1}</legend>
            <Select
              label="Loại câu hỏi"
              value={question.type}
              onChange={(event) => {
                const type = event.target.value as TemplateQuestion['type'];
                update({ type, correctOptions: [] });
              }}
            >
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Input
              label="Câu hỏi"
              name={'question-' + index}
              required
              maxLength={3000}
              value={question.prompt}
              onChange={(event) => update({ prompt: event.target.value })}
            />
            {question.type !== 'TRUE_FALSE' && (
              <TextArea
                label="Phương án, mỗi dòng một phương án"
                rows={3}
                value={question.options.join('\n')}
                onChange={(event) =>
                  update({
                    options: event.target.value.split('\n'),
                    correctOptions: [],
                  })
                }
              />
            )}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Đáp án đúng</legend>
              {options.map(
                (option, position) =>
                  option.trim() && (
                    <label
                      key={position}
                      className="flex items-start gap-2 break-words text-sm"
                    >
                      <input
                        className="mt-1"
                        name={'answer-' + index}
                        type={
                          question.type === 'MULTIPLE_CHOICE'
                            ? 'checkbox'
                            : 'radio'
                        }
                        checked={question.correctOptions.includes(position + 1)}
                        onChange={(event) =>
                          update({
                            correctOptions:
                              question.type !== 'MULTIPLE_CHOICE'
                                ? [position + 1]
                                : event.target.checked
                                  ? [...question.correctOptions, position + 1]
                                  : question.correctOptions.filter(
                                      (entry) => entry !== position + 1,
                                    ),
                          })
                        }
                      />
                      <span className="min-w-0">{option}</span>
                    </label>
                  ),
              )}
            </fieldset>
            <TextArea
              label="Giải thích"
              maxLength={3000}
              value={question.explanation}
              onChange={(event) => update({ explanation: event.target.value })}
            />
            <Button
              variant="secondary"
              onClick={() =>
                onChange(questions.filter((_, position) => position !== index))
              }
            >
              Xóa câu hỏi
            </Button>
          </fieldset>
        );
      })}
      <Button
        variant="secondary"
        disabled={questions.length >= 500}
        onClick={() =>
          onChange([
            ...questions,
            {
              type: 'SINGLE_CHOICE',
              prompt: '',
              options: ['', ''],
              correctOptions: [],
              explanation: '',
            },
          ])
        }
      >
        Thêm câu hỏi
      </Button>
    </section>
  );
}
