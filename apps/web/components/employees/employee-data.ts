import { accountError, apiUrl } from '../../lib/account-api';

export type Catalog = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
};
export type EmployeeRole = 'ADM' | 'PTDT' | 'PD' | 'NV';
export const roleLabels: Record<EmployeeRole, string> = {
  ADM: 'Quản trị doanh nghiệp',
  PTDT: 'Phụ trách đào tạo',
  PD: 'Người phê duyệt',
  NV: 'Nhân viên',
};

export type Employee = {
  id: string;
  employeeCode: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  departmentId: string | null;
  positionId: string | null;
  managerId: string | null;
  joinedAt: string | null;
  status: 'PENDING' | 'ACTIVE' | 'HANDOVER' | 'DISABLED';
  invitationRequired: boolean;
  roles: { role: EmployeeRole; departmentIds: string[] }[];
};

export type Directory = {
  employees: Employee[];
  departments: Catalog[];
  positions: Catalog[];
  quota: {
    accounts: number;
    maxAccounts: number | null;
    accountWarning: boolean;
    storageWarning: boolean;
  };
};

export async function employeeRequest(route = '', init?: RequestInit) {
  const response = await fetch(apiUrl + '/employees' + route, {
    ...init,
    credentials: 'include',
  });
  if (!response.ok) throw new Error(await accountError(response));
  return response;
}

export function employeeMutation(
  route: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: object,
) {
  return employeeRequest(route, {
    method,
    ...(body && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
}
