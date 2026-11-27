'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button, EmptyState, Input, Toast } from '../ui/controls';
import { Modal } from '../ui/Modal';
import {
  AssignmentRuleForm,
  AssignmentSelect,
  ManualAssignmentForm,
} from './AssignmentForms';
import {
  assignmentRequest,
  assignmentStatuses,
  localDateDisplay,
  targetKey,
  type AssignmentOptions,
  type AssignmentRule,
  type Enrollment,
} from './assignment-data';

const actionLabels = {
  extend: 'Gia hạn',
  cancel: 'Hủy phân bổ',
  reassign: 'Giao lại',
};
type EnrollmentAction = keyof typeof actionLabels;

const activeStatuses: Enrollment['status'][] = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'OVERDUE',
];
const panel =
  'space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5';

function EnrollmentList({
  options,
  rows,
  onFilter,
  onAction,
}: {
  options: AssignmentOptions;
  rows: Enrollment[];
  onFilter: (query: string) => Promise<void>;
  onAction: (action: EnrollmentAction, row: Enrollment) => void;
}) {
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const query = new URLSearchParams();
    for (const [key, value] of data)
      if (typeof value === 'string' && value) query.set(key, value);
    void onFilter(query.size ? '?' + query.toString() : '');
  }

  return (
    <section className={panel}>
      <h2 className="text-lg font-semibold text-navy-900">
        Danh sách lượt học
      </h2>
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]"
        onSubmit={filter}
      >
        <AssignmentSelect label="Khóa học" name="courseId">
          <option value="">Tất cả khóa học</option>
          {options.targets
            .filter(({ kind }) => kind === 'course')
            .map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
        </AssignmentSelect>
        <AssignmentSelect label="Nhân viên" name="userId">
          <option value="">Tất cả nhân viên</option>
          {options.employees.map(({ id, fullName }) => (
            <option key={id} value={id}>
              {fullName}
            </option>
          ))}
        </AssignmentSelect>
        <AssignmentSelect label="Trạng thái" name="status">
          <option value="">Tất cả trạng thái</option>
          {Object.entries(assignmentStatuses).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </AssignmentSelect>
        <Button type="submit" variant="secondary" className="self-end">
          Lọc lượt học
        </Button>
      </form>
      {rows.length ? (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0 break-words">
                <p className="font-semibold text-navy-900">{row.courseName}</p>
                <p className="text-sm text-slate-700">
                  {row.employeeName} · Hạn{' '}
                  {localDateDisplay.format(new Date(row.dueAt))}
                </p>
                <p className="text-sm text-slate-600">
                  {assignmentStatuses[row.status]} · {row.progressPercent}% ·
                  Phiên bản {row.courseRevision} ·{' '}
                  {row.source === 'MANUAL' ? 'Thủ công' : 'Tự động'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeStatuses.includes(row.status) && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => onAction('extend', row)}
                    >
                      Gia hạn
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => onAction('cancel', row)}
                    >
                      Hủy phân bổ
                    </Button>
                  </>
                )}
                {(row.status === 'COMPLETED' || row.status === 'FAILED') && (
                  <Button
                    variant="secondary"
                    onClick={() => onAction('reassign', row)}
                  >
                    Giao lại
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Chưa có lượt học phù hợp" />
      )}
    </section>
  );
}

export function Assignments() {
  const [options, setOptions] = useState<AssignmentOptions>();
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const [editing, setEditing] = useState<AssignmentRule | 'new'>();
  const [action, setAction] = useState<{
    kind: EnrollmentAction;
    row: Enrollment;
  }>();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();

  function notify(text: string, error?: boolean) {
    setMessage({ text, error });
  }

  useEffect(() => {
    let current = true;
    Promise.all([
      assignmentRequest<AssignmentOptions>('/options'),
      assignmentRequest<Enrollment[]>(),
      assignmentRequest<AssignmentRule[]>('/rules'),
    ])
      .then(([config, enrollments, savedRules]) => {
        if (!current) return;
        setOptions(config);
        setRows(enrollments);
        setRules(savedRules);
      })
      .catch((error: Error) => {
        if (current) notify(error.message, true);
      });
    return () => {
      current = false;
    };
  }, []);

  async function refresh(next = query) {
    try {
      setRows(await assignmentRequest<Enrollment[]>(next));
      setQuery(next);
    } catch (error) {
      notify((error as Error).message, true);
    }
  }

  async function refreshRules() {
    setRules(await assignmentRequest<AssignmentRule[]>('/rules'));
    await refresh();
  }

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action) return;
    const { kind, row } = action;
    const dueDate = new FormData(event.currentTarget).get('dueDate');
    setActionError(undefined);
    setBusy(true);
    try {
      await assignmentRequest(
        '/' + row.id + '/' + (kind === 'extend' ? 'deadline' : kind),
        {
          method: kind === 'extend' ? 'PATCH' : 'POST',
          body: kind === 'cancel' ? undefined : { dueDate },
        },
      );
      notify('Đã cập nhật lượt học.');
      setAction(undefined);
      await refresh();
    } catch (error) {
      setActionError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {options ? (
        <>
          <section className={panel}>
            <h2 className="text-lg font-semibold text-navy-900">
              Giao đào tạo thủ công
            </h2>
            <ManualAssignmentForm
              options={options}
              onSaved={refresh}
              notify={notify}
            />
          </section>
          <EnrollmentList
            options={options}
            rows={rows}
            onFilter={refresh}
            onAction={(kind, row) => {
              setActionError(undefined);
              setAction({ kind, row });
            }}
          />
          <section className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-navy-900">
                Quy tắc phân bổ tự động
              </h2>
              <Button
                onClick={() => setEditing('new')}
                disabled={!options.targets.length}
              >
                Tạo quy tắc
              </Button>
            </div>
            {editing && (
              <AssignmentRuleForm
                key={editing === 'new' ? editing : editing.id}
                options={options}
                rule={editing === 'new' ? undefined : editing}
                onSaved={refreshRules}
                onClose={() => setEditing(undefined)}
                notify={notify}
              />
            )}
            {rules.length ? (
              <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                {rules.map((rule) => (
                  <li
                    key={rule.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-3"
                  >
                    <div className="min-w-0 break-words">
                      <p className="font-semibold text-navy-900">{rule.name}</p>
                      <p className="text-sm text-slate-600">
                        {options.targets.find(
                          (target) =>
                            targetKey(target) === targetKey(rule.target),
                        )?.name ?? 'Nội dung hiện không phân bổ được'}{' '}
                        · {rule.dueDays} ngày ·{' '}
                        {rule.enabled ? 'Đang áp dụng' : 'Đã tắt'}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => setEditing(rule)}
                    >
                      Chỉnh sửa
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Chưa có quy tắc phân bổ" />
            )}
          </section>
        </>
      ) : (
        <p className="text-sm text-slate-600">
          {message?.error
            ? 'Chưa tải được dữ liệu phân bổ.'
            : 'Đang tải dữ liệu phân bổ…'}
        </p>
      )}
      <Modal
        open={Boolean(action)}
        title={action ? actionLabels[action.kind] : 'Cập nhật lượt học'}
        onClose={() => setAction(undefined)}
      >
        {action && (
          <form className="space-y-3" onSubmit={submitAction}>
            <p className="text-sm text-slate-700">
              {action.row.courseName} · {action.row.employeeName}
            </p>
            {action.kind === 'cancel' ? (
              <p className="text-sm text-slate-700">
                Bạn muốn hủy lượt học này?
              </p>
            ) : (
              <Input
                label="Hạn hoàn thành mới"
                name="dueDate"
                id="update-due-date"
                type="date"
                required
              />
            )}
            {actionError && (
              <p role="alert" className="text-sm text-red-700">
                {actionError}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? 'Đang cập nhật…' : 'Xác nhận'}
            </Button>
          </form>
        )}
      </Modal>
      {message && (
        <Toast error={message.error} onDismiss={() => setMessage(undefined)}>
          {message.text}
        </Toast>
      )}
    </>
  );
}
