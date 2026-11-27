'use client';

import {
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Button, Input } from '../ui/controls';
import {
  assignmentRequest,
  selectedTarget,
  targetKey,
  type AssignmentOptions,
  type AssignmentRule,
} from './assignment-data';

export function AssignmentSelect({
  label,
  children,
  ...props
}: ComponentProps<'select'> & { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="block text-sm font-semibold text-navy-900">{label}</span>
      <select
        {...props}
        className="min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-base text-navy-900"
      >
        {children}
      </select>
    </label>
  );
}

function TargetSelect({
  options,
  initialValue,
}: {
  options: AssignmentOptions;
  initialValue?: string;
}) {
  return (
    <AssignmentSelect
      label="Nội dung đã xuất bản"
      name="target"
      defaultValue={initialValue ?? ''}
      required
    >
      <option value="" disabled>
        Chọn khóa học hoặc chương trình
      </option>
      {options.targets.map((target) => (
        <option key={targetKey(target)} value={targetKey(target)}>
          {target.kind === 'program' ? 'Chương trình · ' : 'Khóa học · '}
          {target.name}
        </option>
      ))}
    </AssignmentSelect>
  );
}

type Notify = (message: string, error?: boolean) => void;

export function ManualAssignmentForm({
  options,
  onSaved,
  notify,
}: {
  options: AssignmentOptions;
  onSaved: () => Promise<void>;
  notify: Notify;
}) {
  const [byDepartment, setByDepartment] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!byDepartment && !selected.length) {
      notify('Chọn ít nhất một nhân viên.', true);
      return;
    }
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    try {
      const { created, extended } = await assignmentRequest<{
        created: number;
        extended: number;
      }>('', {
        method: 'POST',
        body: {
          ...selectedTarget(fields.get('target')),
          dueDate: fields.get('dueDate'),
          ...(byDepartment
            ? { departmentId: fields.get('departmentId') }
            : { userIds: selected }),
        },
      });
      notify(`Đã tạo ${created} lượt học và gia hạn ${extended} lượt.`);
      form.reset();
      setSelected([]);
      await onSaved();
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TargetSelect options={options} />
        <Input
          label="Hạn hoàn thành"
          name="dueDate"
          id="manual-due-date"
          type="date"
          required
        />
      </div>
      <AssignmentSelect
        label="Giao cho"
        value={byDepartment ? 'department' : 'employees'}
        onChange={(event) =>
          setByDepartment(event.target.value === 'department')
        }
      >
        <option value="employees">Nhân viên được chọn</option>
        <option value="department">Cả phòng ban</option>
      </AssignmentSelect>
      {byDepartment ? (
        <AssignmentSelect
          label="Phòng ban"
          name="departmentId"
          defaultValue=""
          required
        >
          <option value="" disabled>
            Chọn phòng ban
          </option>
          {options.departments.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </AssignmentSelect>
      ) : (
        <fieldset className="max-h-56 space-y-2 overflow-auto rounded-lg border border-slate-200 px-3">
          <legend className="text-sm font-semibold text-navy-900">
            Nhân viên
          </legend>
          {options.employees.length ? (
            options.employees.map((employee) => (
              <label
                key={employee.id}
                className="flex min-h-9 items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(employee.id)}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSelected((current) =>
                      checked
                        ? [...current, employee.id]
                        : current.filter((id) => id !== employee.id),
                    );
                  }}
                />
                <span>
                  {employee.fullName}
                  {employee.employeeCode ? ' · ' + employee.employeeCode : ''}
                </span>
              </label>
            ))
          ) : (
            <p className="py-2 text-sm text-slate-600">
              Chưa có nhân viên trong phạm vi.
            </p>
          )}
        </fieldset>
      )}
      <Button type="submit" disabled={busy || !options.targets.length}>
        {busy ? 'Đang phân bổ…' : 'Giao đào tạo'}
      </Button>
    </form>
  );
}

export function AssignmentRuleForm({
  options,
  rule,
  onSaved,
  onClose,
  notify,
}: {
  options: AssignmentOptions;
  rule?: AssignmentRule;
  onSaved: () => Promise<void>;
  onClose: () => void;
  notify: Notify;
}) {
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const joined = fields.get('newHireDays');
      const { applied } = await assignmentRequest<{
        applied: { created: number; extended: number };
      }>('/rules' + (rule ? '/' + rule.id : ''), {
        method: rule ? 'PATCH' : 'POST',
        body: {
          name: fields.get('name'),
          ...selectedTarget(fields.get('target')),
          departmentId: fields.get('departmentId'),
          positionId: fields.get('positionId'),
          newHireDays: joined ? Number(joined) : null,
          dueDays: Number(fields.get('dueDays')),
          enabled: fields.get('enabled') === 'on',
          applyExisting: fields.get('applyExisting') === 'on',
        },
      });
      notify(
        `Đã lưu quy tắc. Tạo ${applied.created} lượt học và gia hạn ${applied.extended} lượt.`,
      );
      await onSaved();
      onClose();
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Tên quy tắc"
          name="name"
          id="assignment-rule-name"
          defaultValue={rule?.name}
          maxLength={200}
          required
        />
        <TargetSelect
          options={options}
          initialValue={rule && targetKey(rule.target)}
        />
        <AssignmentSelect
          label="Phòng ban"
          name="departmentId"
          defaultValue={rule?.departmentId ?? ''}
        >
          <option value="">Mọi phòng ban</option>
          {options.departments.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </AssignmentSelect>
        <AssignmentSelect
          label="Chức danh"
          name="positionId"
          defaultValue={rule?.positionId ?? ''}
        >
          <option value="">Mọi chức danh</option>
          {options.positions.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </AssignmentSelect>
        <Input
          label="Trong số ngày kể từ ngày vào làm"
          name="newHireDays"
          type="number"
          min="0"
          max="3650"
          defaultValue={rule?.newHireDays ?? undefined}
        />
        <Input
          label="Hạn từ ngày giao (ngày)"
          name="dueDays"
          type="number"
          min="1"
          max="3650"
          defaultValue={rule?.dueDays}
          required
        />
      </div>
      <label className="flex min-h-9 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={rule?.enabled ?? true}
        />
        Đang áp dụng
      </label>
      <label className="flex min-h-9 items-center gap-2 text-sm">
        <input type="checkbox" name="applyExisting" /> Áp dụng cho nhân viên
        hiện có
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Đang lưu…' : 'Lưu quy tắc'}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
      </div>
    </form>
  );
}
