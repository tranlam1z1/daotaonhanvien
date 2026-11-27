import { BadRequestException } from '@nestjs/common';
import { loginIdentifier } from '../auth/auth-policy';

export const employeeColumns = {
  employeeCode: 'Mã nhân viên',
  fullName: 'Họ tên',
  email: 'Email',
  phone: 'Số điện thoại',
  departmentId: 'Mã phòng ban (ID)',
  positionId: 'Mã chức danh (ID)',
  managerId: 'Mã quản lý trực tiếp (ID)',
  joinedAt: 'Ngày vào làm (dd/MM/yyyy)',
} as const;

export type EmployeeField = keyof typeof employeeColumns;
export type EmployeeInput = ReturnType<typeof parseEmployee>;
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;

export function objectInput(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new BadRequestException('Thông tin gửi lên không hợp lệ.');
  return body as Record<string, unknown>;
}

export function dateInput(value: string, label = 'Ngày vào làm') {
  if (!value) return null;
  if (typeof value !== 'string')
    throw new BadRequestException(`${label} không hợp lệ.`);
  const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const iso = parts ? [parts[3], parts[2], parts[1]].join('-') : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso.startsWith('0000'))
    throw new BadRequestException(`${label} không hợp lệ.`);
  const date = new Date(iso + 'T00:00:00Z');
  if (
    !Number.isFinite(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== iso
  )
    throw new BadRequestException(`${label} không hợp lệ.`);
  return date;
}

export function parseEmployee(body: unknown) {
  const fields = objectInput(body);
  function field(key: EmployeeField, maximum: number, required = false) {
    const raw = fields[key] ?? '';
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (
      typeof raw !== 'string' ||
      value.length > maximum ||
      (required && !value)
    )
      throw new BadRequestException(employeeColumns[key] + ' không hợp lệ.');
    return value;
  }
  function reference(key: 'departmentId' | 'positionId' | 'managerId') {
    const value = field(key, 36).toLowerCase();
    if (value && !uuid.test(value))
      throw new BadRequestException(employeeColumns[key] + ' không hợp lệ.');
    return value || null;
  }
  const email = field('email', 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new BadRequestException('Email không hợp lệ.');
  const phone = field('phone', 30);
  if (phone && !loginIdentifier(phone)?.byPhone)
    throw new BadRequestException('Số điện thoại không hợp lệ.');
  return {
    employeeCode: field('employeeCode', 50, true),
    fullName: field('fullName', 200, true),
    email,
    phone: phone || null,
    departmentId: reference('departmentId'),
    positionId: reference('positionId'),
    managerId: reference('managerId'),
    joinedAt: dateInput(field('joinedAt', 10)),
  };
}

export function parseRoles(
  body: unknown,
): { role: 'ADM' | 'PTDT' | 'PD'; departmentIds: string[] }[] {
  const { roles } = objectInput(body);
  if (!Array.isArray(roles) || roles.length > 3)
    throw new BadRequestException('Vai trò không hợp lệ.');
  const used = new Set<string>();
  return roles.map((item: unknown) => {
    const { role, departmentIds } = objectInput(item);
    if (
      (role !== 'ADM' && role !== 'PTDT' && role !== 'PD') ||
      used.has(role) ||
      !Array.isArray(departmentIds) ||
      (role === 'ADM' && departmentIds.length > 0)
    )
      throw new BadRequestException('Vai trò hoặc phạm vi không hợp lệ.');
    used.add(role);
    const ids = departmentIds.map((id: unknown) => {
      if (typeof id !== 'string' || !uuid.test(id))
        throw new BadRequestException('Phạm vi phòng ban không hợp lệ.');
      return id.toLowerCase();
    });
    return { role, departmentIds: [...new Set(ids)] };
  });
}
