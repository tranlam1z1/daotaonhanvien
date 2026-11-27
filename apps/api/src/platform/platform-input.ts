import { BadRequestException } from '@nestjs/common';
import { BillingCycle, LeadStatus, TenantStatus } from '@prisma/client';
import { authField, loginIdentifier } from '../auth/auth-policy';

const invalid = () =>
  new BadRequestException('Vui lòng kiểm tra thông tin đã nhập.');

function field(body: unknown, key: string, max: number, required = false) {
  const value = authField(body, key, max).trim();
  if (required && !value) throw invalid();
  return value;
}

export function choice<T extends string>(
  options: Record<string, T>,
  value: unknown,
): T {
  const match = Object.values(options).find((entry) => entry === value);
  if (!match) throw invalid();
  return match;
}

export function uuid(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
  )
    throw invalid();
  return value;
}

export function companyInput(body: unknown) {
  const loginCode = field(body, 'loginCode', 100, true).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(loginCode)) {
    throw new BadRequestException(
      'Mã đăng nhập chỉ gồm chữ không dấu, số và dấu gạch ngang.',
    );
  }
  return {
    name: field(body, 'name', 300, true),
    taxCode: field(body, 'taxCode', 30) || null,
    address: field(body, 'address', 500) || null,
    contactName: field(body, 'contactName', 200) || null,
    contactPhone: field(body, 'contactPhone', 30) || null,
    loginCode,
  };
}

export function newCompanyInput(body: unknown) {
  const email = loginIdentifier(field(body, 'adminEmail', 254, true));
  if (!email || email.byPhone) throw invalid();
  const leadId = field(body, 'leadId', 36);
  return {
    company: companyInput(body),
    leadId: leadId ? uuid(leadId) : null,
    admin: {
      fullName: field(body, 'adminName', 200, true),
      email: email.identifier,
    },
  };
}

export function companyStatus(body: unknown) {
  return choice(TenantStatus, field(body, 'status', 20, true));
}

function positiveInteger(body: unknown, key: string) {
  const value = field(body, key, 10, true);
  const number = Number(value);
  if (!/^\d+$/.test(value) || number < 1 || number > 2147483647)
    throw invalid();
  return number;
}

function money(body: unknown, key: string, zeroAllowed: boolean) {
  const value = field(body, key, 19, true);
  if (
    !/^\d{1,16}(?:\.\d{1,2})?$/.test(value) ||
    (!zeroAllowed && Number(value) <= 0)
  )
    throw invalid();
  return value;
}

export function planInput(body: unknown) {
  return {
    name: field(body, 'name', 200, true),
    maxAccounts: positiveInteger(body, 'maxAccounts'),
    storageGb: positiveInteger(body, 'storageGb'),
    price: money(body, 'price', true),
    cycle: choice(BillingCycle, field(body, 'cycle', 10, true)),
  };
}

function vietnamDate(body: unknown, key: string, endOfDay = false) {
  const value = field(body, key, 10, true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000'))
    throw invalid();
  const calendar = new Date(value);
  if (
    !Number.isFinite(calendar.getTime()) ||
    calendar.toISOString().slice(0, 10) !== value
  )
    throw invalid();
  return new Date(
    value + (endOfDay ? 'T23:59:59.999+07:00' : 'T00:00:00+07:00'),
  );
}

export function subscriptionInput(body: unknown) {
  const startsAt = vietnamDate(body, 'startsAt');
  const endsAt = vietnamDate(body, 'endsAt', true);
  if (endsAt <= startsAt) throw invalid();
  return { planId: uuid(field(body, 'planId', 36, true)), startsAt, endsAt };
}

export const renewalEnd = (body: unknown) => vietnamDate(body, 'endsAt', true);

export function paymentInput(body: unknown) {
  return {
    amount: money(body, 'amount', false),
    paidAt: vietnamDate(body, 'paidAt'),
    notes: field(body, 'notes', 4000) || null,
  };
}

export function leadInput(body: unknown) {
  const assigneeId = field(body, 'assigneeId', 36);
  return {
    status: choice(LeadStatus, field(body, 'status', 20, true)),
    assigneeId: assigneeId ? uuid(assigneeId) : null,
    notes: field(body, 'notes', 4000) || null,
  };
}
