'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { accountError, sendAccountAction } from '../../lib/account-api';
import { roleNames } from '../../lib/workspace';
import { Button, Input } from '../ui/controls';
import { useAccount } from './WorkspaceShell';

export function Profile() {
  const { profile, roles, permissions } = useAccount();
  const roleLabels = roles.map((role) => roleNames[role]).filter(Boolean);
  if (permissions.some(({ scope }) => scope === 'directReports'))
    roleLabels.push('Quản lý trực tiếp');
  const fields = [
    ['Họ và tên', profile.fullName],
    ['Email', profile.email],
    ['Số điện thoại', profile.phone ?? 'Chưa cập nhật'],
    ['Doanh nghiệp', profile.tenantName ?? 'Nền tảng EduCore36'],
    ['Vai trò', roleLabels.join(', ') || 'Chưa có vai trò'],
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
        Hồ sơ cá nhân
      </h1>
      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        <section
          aria-labelledby="profile-title"
          className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
        >
          <h2
            id="profile-title"
            className="text-lg font-semibold text-navy-900"
          >
            Thông tin tài khoản
          </h2>
          <dl className="mt-3 divide-y divide-slate-100 text-sm">
            {fields.map(([label, value]) => (
              <div
                key={label}
                className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)]"
              >
                <dt className="font-medium text-slate-600">{label}</dt>
                <dd className="break-words text-navy-900">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        {permissions.some(
          ({ permission }) => permission === 'session.changePassword',
        ) && <PasswordForm />}
      </div>
    </div>
  );
}

function PasswordForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');
    const form = new FormData(event.currentTarget);
    const password = form.get('password');
    if (password !== form.get('confirmPassword')) {
      setError('Hai mật khẩu mới chưa khớp.');
      return;
    }

    setPending(true);
    try {
      const response = await sendAccountAction('change-password', {
        currentPassword: form.get('currentPassword'),
        password,
      });

      if (response.ok) {
        router.replace('/dang-nhap?mat-khau=da-doi');
        return;
      }
      setError(await accountError(response));
    } catch {
      setError('Không kết nối được. Vui lòng thử lại.');
    }
    setPending(false);
  }

  return (
    <section
      aria-labelledby="password-title"
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
    >
      <h2 id="password-title" className="text-lg font-semibold text-navy-900">
        Đổi mật khẩu
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Mật khẩu mới cần ít nhất 8 ký tự, gồm chữ và số. Sau khi đổi mật khẩu,
        bạn cần đăng nhập lại trên mọi thiết bị.
      </p>
      <form
        method="post"
        onSubmit={submit}
        aria-busy={pending}
        className="mt-4 space-y-4"
      >
        <Input
          label="Mật khẩu hiện tại"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
        />
        <Input
          label="Mật khẩu mới"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={256}
        />
        <Input
          label="Nhập lại mật khẩu mới"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={256}
        />
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? 'Đang lưu…' : 'Lưu mật khẩu'}
        </Button>
      </form>
    </section>
  );
}
