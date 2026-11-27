import { useState } from 'react';
import { Input } from '../ui/controls';
import type { Editor, Program } from './training-data';
import {
  TemplateSourceLabel,
  panel,
  Scope,
  Select,
  SubmitActions,
  TextArea,
} from './TrainingFields';

export function ProgramForm({
  initial,
  catalog,
  disabled,
  onSave,
  onCancel,
}: {
  initial: Program;
  catalog: Editor;
  disabled: boolean;
  onSave: (data: Program) => void;
  onCancel: () => void;
}) {
  const [program, setProgram] = useState(initial);
  const courses = catalog.courses.filter(
    ({ departmentId }) => departmentId === program.departmentId,
  );

  return (
    <form
      className={panel}
      onSubmit={(event) => {
        event.preventDefault();
        onSave(program);
      }}
    >
      <h2 className="text-lg font-semibold text-navy-900">
        {program.id ? 'Sửa chương trình' : 'Tạo chương trình'}
      </h2>
      <TemplateSourceLabel source={program.templateSource} />
      {initial.totalDurationMinutes !== undefined && (
        <p className="text-sm text-navy-900">
          Tổng thời lượng đã lưu{' '}
          {initial.totalDurationMinutes.toLocaleString('vi-VN')} phút.
          {initial.exceedsTarget && (
            <span className="ml-2 font-semibold text-orange-800">
              Vượt thời gian mục tiêu.
            </span>
          )}
        </p>
      )}
      <fieldset disabled={disabled} className="min-w-0 space-y-4">
        <Input
          label="Tên chương trình"
          name="program-name"
          required
          maxLength={200}
          value={program.name}
          onChange={(event) =>
            setProgram({ ...program, name: event.target.value })
          }
        />
        <TextArea
          label="Mô tả chương trình"
          required
          maxLength={5000}
          value={program.description}
          onChange={(event) =>
            setProgram({ ...program, description: event.target.value })
          }
        />
        <Input
          label="Đối tượng"
          name="audience"
          required
          maxLength={1000}
          value={program.audience}
          onChange={(event) =>
            setProgram({ ...program, audience: event.target.value })
          }
        />
        <Scope
          catalog={catalog}
          value={program.departmentId}
          disabled={!!program.id}
          onChange={(departmentId) =>
            setProgram({ ...program, departmentId, courses: [] })
          }
        />
        <Select
          label="Loại chương trình"
          value={program.type}
          onChange={(event) =>
            setProgram({
              ...program,
              type: event.target.value as Program['type'],
            })
          }
        >
          <option value="ONBOARDING">Hội nhập</option>
          <option value="SPECIALIST">Chuyên môn</option>
        </Select>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Thời gian mục tiêu"
            name="target-duration"
            type="number"
            min={1}
            max={2147483647}
            required
            value={program.targetDuration || ''}
            onChange={(event) =>
              setProgram({
                ...program,
                targetDuration: Number(event.target.value),
              })
            }
          />
          <Select
            label="Đơn vị thời gian"
            value={program.targetUnit}
            onChange={(event) =>
              setProgram({
                ...program,
                targetUnit: event.target.value as Program['targetUnit'],
              })
            }
          >
            <option value="DAYS">Ngày</option>
            <option value="HOURS">Giờ</option>
          </Select>
        </div>
        <fieldset className="space-y-1">
          <legend className="text-sm font-semibold text-navy-900">
            Khóa học trong chương trình
          </legend>
          {courses.length === 0 && (
            <p className="text-sm text-slate-600">
              Chưa có khóa học cùng phạm vi.
            </p>
          )}
          {courses.map(({ id, name }) => (
            <label
              key={id}
              className="flex min-h-11 items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={program.courses.some(
                  ({ courseId }) => courseId === id,
                )}
                onChange={(event) =>
                  setProgram({
                    ...program,
                    courses: event.target.checked
                      ? [...program.courses, { courseId: id }]
                      : program.courses.filter(
                          ({ courseId }) => courseId !== id,
                        ),
                  })
                }
              />
              <span className="break-all">{name}</span>
            </label>
          ))}
        </fieldset>
        <SubmitActions label="Lưu chương trình" onCancel={onCancel} />
      </fieldset>
    </form>
  );
}
