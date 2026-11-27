import { Input } from '../ui/controls';
import { Select } from './TrainingFields';
import type { CourseSettings } from './training-data';

const criteria = [
  {
    flag: 'lessonRequired',
    value: 'lessonPercent',
    label: 'Yêu cầu hoàn thành bài học',
    inputLabel: 'Tỷ lệ bài học hoàn thành (%)',
    min: 0,
    max: 100,
  },
  {
    flag: 'finalScoreRequired',
    value: 'finalScorePercent',
    label: 'Yêu cầu đạt bài kiểm tra cuối khóa',
    inputLabel: 'Điểm tối thiểu cuối khóa (%)',
    min: 0,
    max: 100,
  },
  {
    flag: 'attemptLimitEnabled',
    value: 'maxAttempts',
    label: 'Giới hạn số lần làm bài',
    inputLabel: 'Số lần làm tối đa',
    min: 1,
    max: 2_147_483_647,
  },
] as const;

export function CourseCompletionFields({
  settings,
  onChange,
}: {
  settings: CourseSettings;
  onChange: (settings: CourseSettings) => void;
}) {
  const { completion, learningMode } = settings;
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-base font-semibold text-navy-900">
        Điều kiện hoàn thành khóa học
      </legend>
      <Select
        label="Chế độ học"
        value={learningMode}
        onChange={(event) =>
          onChange({
            ...settings,
            learningMode: event.target.value as CourseSettings['learningMode'],
          })
        }
      >
        <option value="SEQUENTIAL">Tuần tự</option>
        <option value="FREE">Tự do</option>
      </Select>
      {criteria.map(({ flag, value, label, inputLabel, min, max }) => (
        <div key={flag} className="grid items-center gap-2 sm:grid-cols-2">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={completion[flag]}
              onChange={(event) =>
                onChange({
                  ...settings,
                  completion: { ...completion, [flag]: event.target.checked },
                })
              }
            />
            {label}
          </label>
          <Input
            label={inputLabel}
            name={value}
            type="number"
            min={min}
            max={max}
            required
            disabled={!completion[flag]}
            value={completion[value]}
            onChange={(event) =>
              onChange({
                ...settings,
                completion: {
                  ...completion,
                  [value]: Number(event.target.value),
                },
              })
            }
          />
        </div>
      ))}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={completion.practiceRequired}
          onChange={(event) =>
            onChange({
              ...settings,
              completion: {
                ...completion,
                practiceRequired: event.target.checked,
              },
            })
          }
        />
        Yêu cầu quản lý trực tiếp xác nhận thực hành
      </label>
    </fieldset>
  );
}
