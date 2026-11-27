'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { apiUrl } from '../../lib/account-api';
import { Button, Input } from '../ui/controls';
import {
  employeeMutation,
  employeeRequest,
  roleLabels,
  type Directory,
  type Employee,
} from './employee-data';

type Done = (message: string) => void;

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Chưa thể xử lý yêu cầu.';
}

function ActionForm({
  submit,
  children,
  label,
}: {
  submit: (data: FormData) => Promise<void>;
  children?: ReactNode;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await submit(data);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handle}>
      <fieldset disabled={busy} className="space-y-4">
        {children}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Button type="submit">{busy ? 'Đang xử lý…' : label}</Button>
      </fieldset>
    </form>
  );
}

function SelectField({
  name,
  label,
  value,
  items,
}: {
  name: string;
  label: string;
  value?: string | null;
  items: { id: string; name: string }[];
}) {
  return (
    <label className="block space-y-1.5 text-sm font-semibold">
      <span>{label}</span>
      <select
        name={name}
        defaultValue={value ?? ''}
        className="block min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 text-base font-normal"
      >
        <option value="">Chưa chọn</option>
        {items.map(({ id, name }) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EmployeeProfileForm({
  employee,
  directory,
  done,
}: {
  employee?: Employee;
  directory: Directory;
  done: Done;
}) {
  return (
    <ActionForm
      label="Lưu nhân viên"
      submit={async (data) => {
        await employeeMutation(
          employee ? '/' + employee.id : '',
          employee ? 'PATCH' : 'POST',
          Object.fromEntries(data),
        );
        done('Đã lưu thông tin nhân viên.');
      }}
    >
      <Input
        label="Mã nhân viên"
        name="employeeCode"
        maxLength={50}
        defaultValue={employee?.employeeCode ?? ''}
        required
      />
      <Input
        label="Họ tên"
        name="fullName"
        maxLength={200}
        defaultValue={employee?.fullName}
        required
      />
      <Input
        label="Email"
        name="email"
        type="email"
        maxLength={254}
        defaultValue={employee?.email}
        required
      />
      <Input
        label="Số điện thoại"
        name="phone"
        type="tel"
        maxLength={30}
        defaultValue={employee?.phone ?? ''}
      />
      <SelectField
        name="departmentId"
        label="Phòng ban"
        value={employee?.departmentId}
        items={directory.departments.filter(
          ({ id, status }) =>
            status === 'ACTIVE' || id === employee?.departmentId,
        )}
      />
      <SelectField
        name="positionId"
        label="Chức danh"
        value={employee?.positionId}
        items={directory.positions.filter(
          ({ id, status }) =>
            status === 'ACTIVE' || id === employee?.positionId,
        )}
      />
      <SelectField
        name="managerId"
        label="Quản lý trực tiếp"
        value={employee?.managerId}
        items={directory.employees
          .filter(({ id }) => id !== employee?.id)
          .map(({ id, fullName, employeeCode }) => ({
            id,
            name: employeeCode
              ? fullName + ' (' + employeeCode + ')'
              : fullName,
          }))}
      />
      <Input
        label="Ngày vào làm (dd/MM/yyyy)"
        name="joinedAt"
        placeholder="dd/MM/yyyy"
        maxLength={10}
        defaultValue={
          employee?.joinedAt?.slice(0, 10).split('-').reverse().join('/') ?? ''
        }
      />
    </ActionForm>
  );
}

const assignable = ['ADM', 'PTDT', 'PD'] as const;

export function EmployeeRolesForm({
  employee,
  directory,
  done,
}: {
  employee: Employee;
  directory: Directory;
  done: Done;
}) {
  const [selected, setSelected] = useState(
    () => new Set(employee.roles.map(({ role }) => role)),
  );
  return (
    <ActionForm
      label="Lưu phân quyền"
      submit={async (data) => {
        const roles = assignable
          .filter((role) => selected.has(role))
          .map((role) => ({
            role,
            departmentIds: data.getAll(role + '-department'),
          }));
        await employeeMutation('/' + employee.id + '/roles', 'PATCH', {
          roles,
        });
        done('Đã lưu phân quyền.');
      }}
    >
      <p className="text-sm text-slate-600">
        Mọi tài khoản doanh nghiệp đều có vai trò Nhân viên.
      </p>
      {assignable.map((role) => (
        <div
          className="space-y-2 rounded-lg border border-slate-200 p-3"
          key={role}
        >
          <label className="flex min-h-11 items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={selected.has(role)}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(role);
                else next.delete(role);
                setSelected(next);
              }}
            />
            {roleLabels[role]}
          </label>
          {role !== 'ADM' && (
            <fieldset
              hidden={!selected.has(role)}
              disabled={!selected.has(role)}
              className="space-y-1 pl-4 text-sm"
            >
              <legend>Phạm vi phòng ban</legend>
              <p className="text-slate-600">
                Để trống để áp dụng cho toàn doanh nghiệp.
              </p>
              <div className="max-h-40 overflow-y-auto">
                {directory.departments.map(({ id, name }) => (
                  <label key={id} className="flex min-h-10 items-center gap-2">
                    <input
                      type="checkbox"
                      name={role + '-department'}
                      value={id}
                      defaultChecked={employee.roles
                        .find((item) => item.role === role)
                        ?.departmentIds.includes(id)}
                    />
                    {name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      ))}
    </ActionForm>
  );
}

type ImportReport = {
  rows: number;
  imported: number;
  errors: { row: number; message: string }[];
};

export function EmployeeImportForm({ done }: { done: Done }) {
  const [file, setFile] = useState<File>();
  const [report, setReport] = useState<ImportReport>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(commit: boolean) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.set('file', file);
      const response = await employeeRequest(
        '/import' + (commit ? '?commit=true' : ''),
        { method: 'POST', body },
      );
      const result = (await response.json()) as ImportReport;
      setReport(result);
      if (result.imported) done('Đã nhập ' + result.imported + ' nhân viên.');
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <a
        className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 underline"
        href={apiUrl + '/employees/template'}
      >
        Tải mẫu Excel
      </a>
      <p className="text-sm text-slate-600">
        Nhập dữ liệu vào trang Nhân viên. Sao chép mã ID từ các trang danh mục
        khi cần.
      </p>
      <Input
        name="employee-file"
        label="Chọn tệp .xlsx"
        type="file"
        accept=".xlsx"
        disabled={busy}
        onChange={(event) => {
          setFile(event.target.files?.[0]);
          setReport(undefined);
          setError('');
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {report && (
        <div className="space-y-2 text-sm">
          <p role="status">
            {report.rows} dòng đã kiểm tra, {report.errors.length} dòng lỗi.
          </p>
          {report.errors.length > 0 && (
            <ul className="max-h-48 list-disc overflow-y-auto pl-5 text-red-700">
              {report.errors.map(({ row, message }) => (
                <li key={row}>
                  Dòng {row} · {message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={!file || busy}
          onClick={() => void submit(false)}
        >
          Kiểm tra tệp
        </Button>
        <Button
          disabled={busy || !report || report.errors.length > 0}
          onClick={() => void submit(true)}
        >
          Lưu nhân viên
        </Button>
      </div>
    </div>
  );
}

export function EmployeeLifecycleForm({
  action,
  employee,
  done,
}: {
  action: 'activate' | 'disable' | 'remove';
  employee: Employee;
  done: Done;
}) {
  const labels = {
    activate:
      employee.status === 'ACTIVE'
        ? 'Gửi lại lời mời'
        : 'Kích hoạt và gửi lời mời',
    disable: 'Vô hiệu hóa',
    remove: 'Xóa nhân viên',
  };
  return (
    <ActionForm
      label={labels[action]}
      submit={async (data) => {
        const route = '/' + employee.id;
        if (action === 'activate') {
          const response = await employeeMutation(route + '/activate', 'POST');
          const { invitationSent } = (await response.json()) as {
            invitationSent: boolean | null;
          };
          done(
            invitationSent === false
              ? 'Đã giữ chỗ cho tài khoản. Chưa gửi được email, vui lòng gửi lại lời mời.'
              : invitationSent
                ? 'Đã gửi lời mời đặt mật khẩu.'
                : 'Tài khoản đang hoạt động.',
          );
        } else if (action === 'disable') {
          await employeeMutation(route + '/disable', 'POST', {
            reason: data.get('reason'),
          });
          done('Đã vô hiệu hóa tài khoản.');
        } else {
          await employeeMutation(route, 'DELETE');
          done('Đã xóa nhân viên.');
        }
      }}
    >
      <p className="break-words text-sm font-semibold">
        {employee.fullName} · {employee.email}
      </p>
      {action === 'disable' && (
        <Input
          name="reason"
          label={
            employee.status === 'HANDOVER'
              ? 'Lý do vô hiệu hóa (bắt buộc)'
              : 'Lý do vô hiệu hóa'
          }
          maxLength={500}
          required={employee.status === 'HANDOVER'}
        />
      )}
    </ActionForm>
  );
}
