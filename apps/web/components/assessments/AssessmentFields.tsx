import { Select } from '../training/TrainingFields';
import { Input } from '../ui/controls';
import type { Catalog, QuestionGroup } from './assessment-data';

export function DepartmentField({
  catalog,
  value,
  disabled,
  onChange,
}: {
  catalog: Catalog;
  value: string | null;
  disabled?: boolean;
  onChange: (value: string | null) => void;
}) {
  return (
    <Select
      label="Phạm vi"
      name="departmentId"
      value={value ?? ''}
      required={!catalog.tenantWide}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="" disabled={!catalog.tenantWide}>
        {catalog.tenantWide ? 'Toàn doanh nghiệp' : 'Chọn phòng ban'}
      </option>
      {catalog.departments.map(({ id, name }) => (
        <option value={id} key={id}>
          {name}
        </option>
      ))}
    </Select>
  );
}

export function QuestionGroupFields({
  catalog,
  value,
  onChange,
}: {
  catalog: Catalog;
  value: QuestionGroup;
  onChange: (group: QuestionGroup) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <DepartmentField
        catalog={catalog}
        value={value.departmentId}
        onChange={(departmentId) =>
          onChange({ ...value, departmentId, courseId: null })
        }
      />
      <Select
        label="Nhóm câu hỏi"
        name="courseId"
        value={value.courseId ?? ''}
        onChange={({ target }) =>
          onChange({ ...value, courseId: target.value || null, topic: '' })
        }
      >
        <option value="">Theo chủ đề</option>
        {catalog.courses
          .filter(({ departmentId }) => departmentId === value.departmentId)
          .map(({ id, name }) => (
            <option value={id} key={id}>
              {name}
            </option>
          ))}
      </Select>
      {!value.courseId && (
        <Input
          label="Chủ đề"
          name="topic"
          required
          maxLength={160}
          value={value.topic}
          onChange={({ target }) => onChange({ ...value, topic: target.value })}
        />
      )}
    </div>
  );
}
