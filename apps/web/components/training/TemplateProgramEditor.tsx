'use client';

import { Button, Input } from '../ui/controls';
import { Select, TextArea } from './TrainingFields';

type Lesson = {
  id: string;
  name: string;
  durationMinutes: number;
  body: string;
};
type Module = { id: string; name: string; lessons: Lesson[] };
type Course = {
  id: string;
  name: string;
  description: string;
  modules: Module[];
};
export type TemplateProgram = {
  id: string;
  name: string;
  description: string;
  audience: string;
  type: 'ONBOARDING' | 'SPECIALIST';
  targetDuration: number;
  targetUnit: 'HOURS' | 'DAYS';
  courses: Course[];
};

const lesson = (): Lesson => ({
  id: crypto.randomUUID(),
  name: '',
  durationMinutes: 1,
  body: '',
});
const moduleItem = (): Module => ({
  id: crypto.randomUUID(),
  name: '',
  lessons: [lesson()],
});
const courseItem = (): Course => ({
  id: crypto.randomUUID(),
  name: '',
  description: '',
  modules: [moduleItem()],
});

export function newTemplateProgram(): TemplateProgram {
  return {
    id: crypto.randomUUID(),
    name: '',
    description: '',
    audience: '',
    type: 'ONBOARDING',
    targetDuration: 1,
    targetUnit: 'HOURS',
    courses: [courseItem()],
  };
}

function NestedItems<T extends { id: string }>({
  label,
  items,
  create,
  onChange,
  render,
}: {
  label: string;
  items: T[];
  create: () => T;
  onChange: (items: T[]) => void;
  render: (item: T, update: (changes: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <details
          key={item.id}
          open={index === 0}
          className="rounded-lg border border-slate-200 p-3"
        >
          <summary className="cursor-pointer font-semibold">
            {label} {index + 1}
          </summary>
          <div className="mt-3 space-y-3">
            {render(item, (changes) =>
              onChange(
                items.map((entry) =>
                  entry.id === item.id ? { ...entry, ...changes } : entry,
                ),
              ),
            )}
            <Button
              variant="secondary"
              disabled={items.length === 1}
              onClick={() => onChange(items.filter(({ id }) => id !== item.id))}
            >
              Xóa {label.toLocaleLowerCase('vi')}
            </Button>
          </div>
        </details>
      ))}
      <Button
        variant="secondary"
        disabled={items.length >= 100}
        onClick={() => onChange([...items, create()])}
      >
        Thêm {label.toLocaleLowerCase('vi')}
      </Button>
    </div>
  );
}

export function TemplateProgramEditor({
  value,
  onChange,
}: {
  value: TemplateProgram;
  onChange: (program: TemplateProgram) => void;
}) {
  const update = (changes: Partial<TemplateProgram>) =>
    onChange({ ...value, ...changes });
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-navy-900">Nội dung chương trình mẫu</h2>
      <Input
        name="template-program-name"
        label="Tên chương trình"
        value={value.name}
        required
        maxLength={200}
        onChange={(event) => update({ name: event.target.value })}
      />
      <TextArea
        label="Mô tả chương trình"
        value={value.description}
        required
        maxLength={5000}
        onChange={(event) => update({ description: event.target.value })}
      />
      <Input
        name="template-program-audience"
        label="Đối tượng"
        value={value.audience}
        required
        maxLength={1000}
        onChange={(event) => update({ audience: event.target.value })}
      />
      <Select
        label="Loại chương trình"
        value={value.type}
        onChange={(event) =>
          update({
            type:
              event.target.value === 'SPECIALIST' ? 'SPECIALIST' : 'ONBOARDING',
          })
        }
      >
        <option value="ONBOARDING">Hội nhập</option>
        <option value="SPECIALIST">Chuyên môn</option>
      </Select>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          name="template-program-duration"
          label="Thời lượng mục tiêu"
          type="number"
          min={1}
          value={value.targetDuration || ''}
          required
          onChange={(event) =>
            update({ targetDuration: Number(event.target.value) })
          }
        />
        <Select
          label="Đơn vị thời lượng"
          value={value.targetUnit}
          onChange={(event) =>
            update({
              targetUnit: event.target.value === 'DAYS' ? 'DAYS' : 'HOURS',
            })
          }
        >
          <option value="HOURS">Giờ</option>
          <option value="DAYS">Ngày</option>
        </Select>
      </div>
      <NestedItems
        label="Khóa học"
        items={value.courses}
        create={courseItem}
        onChange={(courses) => update({ courses })}
        render={(course, updateCourse) => (
          <>
            <Input
              name={course.id + '-name'}
              label="Tên khóa học"
              maxLength={200}
              value={course.name}
              onChange={(event) => updateCourse({ name: event.target.value })}
            />
            <TextArea
              label="Mô tả khóa học"
              maxLength={5000}
              value={course.description}
              onChange={(event) =>
                updateCourse({ description: event.target.value })
              }
            />
            <NestedItems
              label="Module"
              items={course.modules}
              create={moduleItem}
              onChange={(modules) => updateCourse({ modules })}
              render={(module, updateModule) => (
                <>
                  <Input
                    name={module.id + '-name'}
                    label="Tên module"
                    maxLength={200}
                    value={module.name}
                    onChange={(event) =>
                      updateModule({ name: event.target.value })
                    }
                  />
                  <NestedItems
                    label="Bài học"
                    items={module.lessons}
                    create={lesson}
                    onChange={(lessons) => updateModule({ lessons })}
                    render={(entry, updateLesson) => (
                      <>
                        <Input
                          name={entry.id + '-name'}
                          label="Tên bài học"
                          maxLength={200}
                          value={entry.name}
                          onChange={(event) =>
                            updateLesson({ name: event.target.value })
                          }
                        />
                        <Input
                          name={entry.id + '-duration'}
                          label="Thời lượng bài học (phút)"
                          type="number"
                          min={1}
                          value={entry.durationMinutes || ''}
                          onChange={(event) =>
                            updateLesson({
                              durationMinutes: Number(event.target.value),
                            })
                          }
                        />
                        <TextArea
                          label="Văn bản bài học"
                          maxLength={50000}
                          value={entry.body}
                          onChange={(event) =>
                            updateLesson({ body: event.target.value })
                          }
                        />
                      </>
                    )}
                  />
                </>
              )}
            />
          </>
        )}
      />
    </section>
  );
}
