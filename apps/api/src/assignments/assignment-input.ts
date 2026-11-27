import { BadRequestException } from '@nestjs/common';
import { idInput, object, text } from '../knowledge/knowledge-input';

export type AssignmentTarget = { kind: 'course' | 'program'; id: string };

export const dayMs = 24 * 60 * 60 * 1000;
const vietnamOffsetMs = 7 * 60 * 60 * 1000;

export function localDay(value: Date) {
  return Math.floor((value.getTime() + vietnamOffsetMs) / dayMs);
}

export function assignmentDeadline(input: unknown) {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input))
    throw new BadRequestException('Hạn hoàn thành không hợp lệ.');
  const midnight = new Date(input + 'T00:00:00Z');
  if (
    !Number.isFinite(midnight.valueOf()) ||
    midnight.toISOString().slice(0, 10) !== input
  )
    throw new BadRequestException('Hạn hoàn thành không hợp lệ.');
  return new Date(midnight.valueOf() + dayMs - vietnamOffsetMs - 1);
}

function targetInput(data: Record<string, unknown>): AssignmentTarget {
  const { kind, targetId } = data;
  if (kind !== 'course' && kind !== 'program')
    throw new BadRequestException('Loại nội dung đào tạo không hợp lệ.');
  return { kind, id: idInput(targetId) };
}

function optionalId(value: unknown) {
  return value == null || value === '' ? null : idInput(value);
}

export function manualInput(body: unknown) {
  const data = object(body);
  const recipients = data.userIds === undefined ? [] : data.userIds;
  if (!Array.isArray(recipients) || recipients.length > 100)
    throw new BadRequestException('Danh sách nhân viên không hợp lệ.');
  const userIds = [...new Set(recipients.map(idInput))];
  const departmentId = optionalId(data.departmentId);
  if (Boolean(userIds.length) === Boolean(departmentId))
    throw new BadRequestException(
      'Chọn danh sách nhân viên hoặc một phòng ban.',
    );
  return {
    target: targetInput(data),
    userIds,
    departmentId,
    dueAt: assignmentDeadline(data.dueDate),
  };
}

function days(value: unknown, label: string, minimum: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > 3650
  )
    throw new BadRequestException(label + ' không hợp lệ.');
  return value;
}

export function ruleInput(body: unknown) {
  const data = object(body);
  const departmentId = optionalId(data.departmentId);
  const positionId = optionalId(data.positionId);
  const newHireDays =
    data.newHireDays == null
      ? null
      : days(data.newHireDays, 'Số ngày kể từ ngày vào làm', 0);
  if (!departmentId && !positionId && newHireDays === null)
    throw new BadRequestException('Cần ít nhất một điều kiện phân bổ.');
  if (typeof data.applyExisting !== 'boolean')
    throw new BadRequestException('Lựa chọn áp dụng không hợp lệ.');
  return {
    name: text(data.name, 200, 'Tên quy tắc', true),
    target: targetInput(data),
    departmentId,
    positionId,
    newHireDays,
    dueDays: days(data.dueDays, 'Số ngày hoàn thành', 1),
    applyExisting: data.applyExisting,
  };
}
