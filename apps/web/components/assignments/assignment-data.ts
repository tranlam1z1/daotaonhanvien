import { accountError, apiUrl } from '../../lib/account-api';

export type AssignmentTarget = {
  id: string;
  kind: 'course' | 'program';
  name: string;
};
export type AssignmentEmployee = {
  id: string;
  fullName: string;
  employeeCode: string | null;
};
export type AssignmentLabel = { id: string; name: string };

export type AssignmentOptions = {
  targets: AssignmentTarget[];
  employees: AssignmentEmployee[];
  departments: AssignmentLabel[];
  positions: AssignmentLabel[];
};

export const assignmentStatuses = {
  NOT_STARTED: 'Chưa bắt đầu',
  IN_PROGRESS: 'Đang học',
  OVERDUE: 'Quá hạn',
  COMPLETED: 'Hoàn thành',
  FAILED: 'Chưa đạt',
  CANCELLED: 'Đã hủy',
};

export type Enrollment = {
  id: string;
  courseName: string;
  employeeName: string;
  courseRevision: number;
  status: keyof typeof assignmentStatuses;
  source: 'MANUAL' | 'AUTOMATIC';
  dueAt: string;
  progressPercent: number;
};

export type AssignmentRule = {
  id: string;
  name: string;
  target: Pick<AssignmentTarget, 'id' | 'kind'>;
  departmentId: string | null;
  positionId: string | null;
  newHireDays: number | null;
  dueDays: number;
  enabled: boolean;
};

export async function assignmentRequest<T>(
  path = '',
  options?: { method: string; body?: object },
) {
  const response = await fetch(apiUrl + '/assignments' + path, {
    cache: 'no-store',
    credentials: 'include',
    method: options?.method ?? 'GET',
    headers: options?.body && { 'Content-Type': 'application/json' },
    body: options?.body && JSON.stringify(options.body),
  });
  if (!response.ok) throw new Error(await accountError(response));
  return (await response.json()) as T;
}

export function targetKey(target: Pick<AssignmentTarget, 'id' | 'kind'>) {
  return target.kind + ':' + target.id;
}

export function selectedTarget(value: FormDataEntryValue | null) {
  const [kind, targetId] = String(value ?? '').split(':');
  return { kind, targetId };
}

export const localDateDisplay = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
