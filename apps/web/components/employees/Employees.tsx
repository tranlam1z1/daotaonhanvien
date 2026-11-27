'use client';

import { useEffect, useState } from 'react';
import { Button, EmptyState, Toast } from '../ui/controls';
import { Modal } from '../ui/Modal';
import {
  EmployeeImportForm,
  EmployeeLifecycleForm,
  EmployeeProfileForm,
  EmployeeRolesForm,
} from './EmployeeForms';
import {
  employeeRequest,
  roleLabels,
  type Directory,
  type Employee,
} from './employee-data';

type Dialog =
  | { type: 'create' | 'import' }
  | {
      type: 'edit' | 'roles' | 'activate' | 'disable' | 'remove';
      employee: Employee;
    };

const statuses = {
  PENDING: 'Chờ kích hoạt',
  ACTIVE: 'Đang hoạt động',
  HANDOVER: 'Đang bàn giao',
  DISABLED: 'Đã vô hiệu hóa',
};
const dialogTitles = {
  create: 'Thêm nhân viên',
  edit: 'Sửa thông tin nhân viên',
  import: 'Nhập nhân viên từ Excel',
  roles: 'Phân quyền nhân viên',
  activate: 'Kích hoạt tài khoản',
  disable: 'Vô hiệu hóa tài khoản',
  remove: 'Xóa nhân viên',
};

export function Employees() {
  const [directory, setDirectory] = useState<Directory>();
  const [dialog, setDialog] = useState<Dialog>();
  const [notice, setNotice] = useState('');
  const [loadError, setLoadError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    void employeeRequest('', { signal: request.signal })
      .then((response) => response.json() as Promise<Directory>)
      .then((response) => {
        if (request.signal.aborted) return;
        setDirectory(response);
        setLoadError('');
      })
      .catch((error: unknown) => {
        if (request.signal.aborted) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Chưa tải được danh sách nhân viên.',
        );
      });
    return () => request.abort();
  }, [version]);

  if (!directory && !loadError)
    return <p role="status">Đang tải danh sách nhân viên…</p>;

  function done(message: string) {
    setDialog(undefined);
    setNotice(message);
    setVersion((value) => value + 1);
  }

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-red-700">
            {loadError}
          </p>
          <Button
            variant="secondary"
            onClick={() => setVersion((value) => value + 1)}
          >
            Thử lại
          </Button>
        </div>
      )}
      {directory && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                Tài khoản đang dùng · {directory.quota.accounts}
                {directory.quota.maxAccounts !== null &&
                  ' / ' + directory.quota.maxAccounts}
              </p>
              {directory.quota.accountWarning && (
                <p className="text-sm text-orange-800">
                  Số tài khoản đã đạt ngưỡng cảnh báo của gói.
                </p>
              )}
              {directory.quota.storageWarning && (
                <p className="text-sm text-orange-800">
                  Dung lượng đã đạt ngưỡng cảnh báo của gói.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => setDialog({ type: 'import' })}
              >
                Nhập Excel
              </Button>
              <Button onClick={() => setDialog({ type: 'create' })}>
                Thêm nhân viên
              </Button>
            </div>
          </div>
          {directory.employees.length === 0 && (
            <EmptyState title="Chưa có nhân viên" />
          )}
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white empty:hidden">
            {directory.employees.map((employee) => {
              const department = directory.departments.find(
                ({ id }) => id === employee.departmentId,
              );
              const position = directory.positions.find(
                ({ id }) => id === employee.positionId,
              );
              const awaitingPassword =
                employee.status === 'ACTIVE' && employee.invitationRequired;
              const mayRemove =
                employee.status === 'DISABLED' || employee.status === 'PENDING';
              return (
                <li
                  key={employee.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0 space-y-1 break-words text-sm">
                    <p className="font-semibold">
                      {employee.fullName}
                      {employee.employeeCode && ' · ' + employee.employeeCode}
                    </p>
                    <p className="text-slate-600">{employee.email}</p>
                    {(department || position) && (
                      <p className="text-slate-600">
                        {[department?.name, position?.name]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                    <p>
                      {awaitingPassword
                        ? 'Chờ đặt mật khẩu'
                        : statuses[employee.status]}{' '}
                      ·{' '}
                      {employee.roles
                        .filter(({ role }) => role !== 'NV')
                        .map(({ role }) => roleLabels[role])
                        .concat(roleLabels.NV)
                        .join(', ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setDialog({ type: 'edit', employee })}
                    >
                      Sửa
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setDialog({ type: 'roles', employee })}
                    >
                      Phân quyền
                    </Button>
                    {(mayRemove || awaitingPassword) && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setDialog({ type: 'activate', employee })
                        }
                      >
                        {awaitingPassword ? 'Gửi lại lời mời' : 'Kích hoạt'}
                      </Button>
                    )}
                    {!mayRemove && (
                      <Button
                        variant="secondary"
                        onClick={() => setDialog({ type: 'disable', employee })}
                      >
                        Vô hiệu hóa
                      </Button>
                    )}
                    {mayRemove && (
                      <Button
                        variant="secondary"
                        onClick={() => setDialog({ type: 'remove', employee })}
                      >
                        Xóa
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <Modal
            open={!!dialog}
            title={dialog ? dialogTitles[dialog.type] : ''}
            onClose={() => setDialog(undefined)}
          >
            {dialog?.type === 'create' && (
              <EmployeeProfileForm directory={directory} done={done} />
            )}
            {dialog?.type === 'edit' && (
              <EmployeeProfileForm
                employee={dialog.employee}
                directory={directory}
                done={done}
              />
            )}
            {dialog?.type === 'roles' && (
              <EmployeeRolesForm
                employee={dialog.employee}
                directory={directory}
                done={done}
              />
            )}
            {dialog?.type === 'import' && <EmployeeImportForm done={done} />}
            {(dialog?.type === 'activate' ||
              dialog?.type === 'disable' ||
              dialog?.type === 'remove') && (
              <EmployeeLifecycleForm
                employee={dialog.employee}
                action={dialog.type}
                done={done}
              />
            )}
          </Modal>
        </>
      )}
      {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    </div>
  );
}
