'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { accountError, sendAccountAction } from '../../lib/account-api';
import { Button, Input } from '../ui/controls';
import { useEffect, useState, type FormEvent } from 'react';

type Mode = 'login' | 'forgot-password' | 'reset-password';

const authLink =
  'font-semibold text-blue-700 underline-offset-4 hover:underline';
const text = {
  login: {
    title: 'Đăng nhập',
    help: 'Dùng email hoặc số điện thoại của tài khoản EduCore36.',
    button: 'Đăng nhập',
  },
  'forgot-password': {
    title: 'Quên mật khẩu',
    help: 'Nhập email tài khoản để nhận đường dẫn đặt lại mật khẩu.',
    button: 'Gửi đường dẫn',
  },
  'reset-password': {
    title: 'Đặt lại mật khẩu',
    help: 'Mật khẩu cần ít nhất 8 ký tự, gồm chữ và số.',
    button: 'Lưu mật khẩu',
  },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [link, setLink] = useState<{ token: string; invite: boolean } | null>(
    null,
  );
  const isLogin = mode === 'login';
  const isReset = mode === 'reset-password';
  const copy = text[mode];

  useEffect(() => {
    if (!isReset) return;
    const readLink = () => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const token = params.get('token') ?? '';
      setLink({
        token: /^[A-Za-z0-9_-]{43}$/.test(token) ? token : '',
        invite: params.get('mode') === 'invite',
      });
    };
    readLink();
    window.addEventListener('hashchange', readLink);
    return () => window.removeEventListener('hashchange', readLink);
  }, [isReset]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');

    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const companyCode = String(form.get('companyCode') ?? '').trim();
    if (isReset && password !== form.get('confirmPassword')) {
      setError('Hai mật khẩu chưa khớp.');
      return;
    }

    const body = isLogin
      ? { identifier: form.get('identifier'), password, companyCode }
      : isReset
        ? { token: link?.token, password, mode: link?.invite ? 'invite' : '' }
        : { email: form.get('email'), companyCode };
    setPending(true);
    try {
      const response = await sendAccountAction(mode, body);

      if (!response.ok) {
        setError(await accountError(response));
        return;
      }
      if (isReset) {
        window.history.replaceState(
          window.history.state,
          '',
          window.location.pathname,
        );
        setSuccess(
          link?.invite
            ? 'Tài khoản đã được kích hoạt.'
            : 'Mật khẩu đã được đặt lại.',
        );
      } else if (isLogin) {
        router.replace('/ung-dung');
        return;
      } else {
        setSuccess(
          'Nếu tài khoản phù hợp, hướng dẫn đặt lại mật khẩu sẽ được gửi qua email.',
        );
      }
    } catch {
      setError('Không kết nối được. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h1 className="mt-7 text-2xl font-bold text-navy-900">
        {link?.invite ? 'Kích hoạt tài khoản' : copy.title}
      </h1>
      {success ? (
        <p
          role="status"
          className="mt-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-900"
        >
          {success}
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm leading-6 text-slate-600">{copy.help}</p>
          {isReset && link?.token === '' ? (
            <p role="alert" className="mt-4 text-sm text-red-700">
              Đường dẫn không hợp lệ. Vui lòng kiểm tra email hoặc yêu cầu gửi
              đường dẫn mới.
            </p>
          ) : (
            <form
              method="post"
              onSubmit={submit}
              className="mt-5 space-y-4"
              aria-busy={pending}
            >
              {isLogin && (
                <Input
                  label="Email hoặc số điện thoại"
                  name="identifier"
                  autoComplete="username"
                  maxLength={320}
                  required
                />
              )}
              {!isLogin && !isReset && (
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={320}
                  required
                />
              )}
              {!isReset && (
                <Input
                  label="Mã doanh nghiệp (nếu cần)"
                  name="companyCode"
                  autoComplete="organization"
                  maxLength={100}
                />
              )}
              {(isLogin || isReset) && (
                <Input
                  label={isReset ? 'Mật khẩu mới' : 'Mật khẩu'}
                  name="password"
                  type="password"
                  autoComplete={isReset ? 'new-password' : 'current-password'}
                  minLength={isReset ? 8 : undefined}
                  maxLength={256}
                  required
                />
              )}
              {isReset && (
                <Input
                  label="Nhập lại mật khẩu mới"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={256}
                  required
                />
              )}
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={pending || (isReset && !link?.token)}
                className="w-full"
              >
                {pending ? 'Đang xử lý…' : copy.button}
              </Button>
            </form>
          )}
        </>
      )}
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {isLogin && !success && (
          <Link href="/quen-mat-khau" className={authLink}>
            Quên mật khẩu?
          </Link>
        )}
        {!isLogin && (
          <Link href="/dang-nhap" className={authLink}>
            Quay lại đăng nhập
          </Link>
        )}
        {isReset && !success && !link?.invite && (
          <Link href="/quen-mat-khau" className={authLink}>
            Gửi đường dẫn mới
          </Link>
        )}
      </div>
    </>
  );
}
