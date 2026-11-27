import { BadRequestException } from '@nestjs/common';
import { RecordStatus, type Prisma } from '@prisma/client';
import { authField } from '../auth/auth-policy';

const invalid = () =>
  new BadRequestException('Vui lòng kiểm tra thông tin đã nhập.');

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function name(body: unknown, max: number) {
  const value = authField(body, 'name', max).trim();
  if (!value) throw invalid();
  return value;
}

export function logoUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function profileInput(body: unknown) {
  const logo = authField(body, 'logo', 2048).trim();
  const normalizedLogo = logoUrl(logo);
  if (logo && !normalizedLogo)
    throw new BadRequestException('Đường dẫn logo phải dùng HTTPS.');
  return {
    name: name(body, 300),
    logo: normalizedLogo,
    address: authField(body, 'address', 500).trim() || null,
    taxCode: authField(body, 'taxCode', 30).trim() || null,
    contactName: authField(body, 'contactName', 200).trim() || null,
    contactPhone: authField(body, 'contactPhone', 30).trim() || null,
  };
}

export function catalogInput(body: unknown) {
  const status = object(body).status;
  if (status !== RecordStatus.ACTIVE && status !== RecordStatus.INACTIVE)
    throw invalid();
  return { name: name(body, 200), status };
}

export function departmentParentInput(body: unknown) {
  const raw = object(body).parentId;
  if (raw === undefined || raw === null) return raw;
  const value = authField(body, 'parentId', 36).trim().toLowerCase();
  if (value && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(value))
    throw new BadRequestException('Phòng ban cấp trên không hợp lệ.');
  return value || null;
}

const defaults = {
  selfApproval: false,
  reminderDays: 0,
  handoverDays: null as number | null,
  completion: {
    lessonRequired: true,
    lessonPercent: 100,
    finalScoreRequired: true,
    finalScorePercent: 70,
    attemptLimitEnabled: true,
    maxAttempts: 3,
    practiceRequired: false,
  },
};

function configFields(value: unknown, strict: boolean) {
  const config = object(value);
  const completion = object(config.completion);
  function checked(input: unknown, valid: boolean) {
    if (strict && input !== undefined && !valid) throw invalid();
  }

  function flag(input: unknown, fallback: boolean) {
    checked(input, typeof input === 'boolean');
    return typeof input === 'boolean' ? input : fallback;
  }

  function integer(input: unknown, fallback: number, min: number, max: number) {
    const valid =
      typeof input === 'number' &&
      Number.isInteger(input) &&
      input >= min &&
      input <= max;
    checked(input, valid);
    return valid ? input : fallback;
  }

  const maxInteger = 2_147_483_647;
  return {
    selfApproval: flag(config.selfApproval, defaults.selfApproval),
    reminderDays: integer(
      config.reminderDays,
      defaults.reminderDays,
      0,
      maxInteger,
    ),
    handoverDays:
      config.handoverDays == null
        ? defaults.handoverDays
        : integer(config.handoverDays, 0, 0, maxInteger),
    completion: {
      lessonRequired: flag(
        completion.lessonRequired,
        defaults.completion.lessonRequired,
      ),
      lessonPercent: integer(
        completion.lessonPercent,
        defaults.completion.lessonPercent,
        0,
        100,
      ),
      finalScoreRequired: flag(
        completion.finalScoreRequired,
        defaults.completion.finalScoreRequired,
      ),
      finalScorePercent: integer(
        completion.finalScorePercent,
        defaults.completion.finalScorePercent,
        0,
        100,
      ),
      attemptLimitEnabled: flag(
        completion.attemptLimitEnabled,
        defaults.completion.attemptLimitEnabled,
      ),
      maxAttempts: integer(
        completion.maxAttempts,
        defaults.completion.maxAttempts,
        1,
        maxInteger,
      ),
      practiceRequired: flag(
        completion.practiceRequired,
        defaults.completion.practiceRequired,
      ),
    },
  };
}

export function readConfig(value: Prisma.JsonValue) {
  return configFields(value, false);
}

export function parseCompletionConfig(
  current: ReturnType<typeof readConfig>['completion'],
  input: unknown,
) {
  if (input === undefined) return { ...current };
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw invalid();
  return configFields(
    { completion: { ...current, ...object(input) } },
    true,
  ).completion;
}

function jsonObject(value: Prisma.JsonValue | undefined): Prisma.JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

export function updateConfig(
  existing: Prisma.JsonValue,
  body: unknown,
): Prisma.InputJsonObject {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
  const update = object(body);
  if (
    'completion' in update &&
    (!update.completion ||
      typeof update.completion !== 'object' ||
      Array.isArray(update.completion))
  )
    throw invalid();

  const current = jsonObject(existing);
  const saved = readConfig(existing);
  const config = configFields(
    {
      ...saved,
      ...update,
      completion: { ...saved.completion, ...object(update.completion) },
    },
    true,
  );
  return {
    ...current,
    ...config,
    completion: { ...jsonObject(current.completion), ...config.completion },
  };
}
