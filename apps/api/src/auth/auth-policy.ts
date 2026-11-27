import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

const minute = 60_000;
export const authPolicy = {
  minimumPasswordLength: 8,
  maximumPasswordLength: 256,
  loginAttempts: 5,
  lockMs: 15 * minute,
  sessionIdleMs: 7 * 24 * 60 * minute,
  resetMs: 60 * minute,
  invitationMs: 24 * 60 * minute,
};

export const sessionCookie = 'educore36_session';
export const invalidLogin = 'Thông tin đăng nhập không hợp lệ.';
export const invalidLink =
  'Đường dẫn không hợp lệ, đã hết hạn hoặc đã được sử dụng.';
export const invalidSession =
  'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
export const resetNotice =
  'Nếu tài khoản phù hợp, hướng dẫn đặt lại mật khẩu sẽ được gửi qua email.';

export const webOrigin = () =>
  new URL(process.env.WEB_ORIGIN ?? 'http://localhost:3000').origin;
export const newSecret = () => randomBytes(32).toString('base64url');
export const isSecret = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);
export const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');

export function authField(body: unknown, key: string, max = 256) {
  const value =
    body && typeof body === 'object'
      ? (body as Record<string, unknown>)[key]
      : undefined;
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > max) {
    throw new BadRequestException('Vui lòng kiểm tra thông tin đã nhập.');
  }
  return value;
}

export function checkPassword(password: string) {
  if (
    password.length < authPolicy.minimumPasswordLength ||
    password.length > authPolicy.maximumPasswordLength ||
    !/\p{L}/u.test(password) ||
    !/\d/.test(password)
  ) {
    throw new BadRequestException(
      'Mật khẩu cần ít nhất 8 ký tự, gồm chữ và số.',
    );
  }
}

export function loginIdentifier(value: string) {
  const identifier = value.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier))
    return { identifier, byPhone: false };
  const phone = identifier.replace(/[\s.()-]/g, '').replace(/^\+84/, '0');
  if (/^\+?\d{8,15}$/.test(phone)) return { identifier: phone, byPhone: true };
  return null;
}
