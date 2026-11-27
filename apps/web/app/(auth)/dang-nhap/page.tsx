import type { Metadata } from 'next';
import { AuthForm } from '../../../components/auth/AuthForm';

export const metadata: Metadata = { title: 'Đăng nhập | EduCore36' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ 'mat-khau'?: string | string[] }>;
}) {
  const passwordChanged = (await searchParams)['mat-khau'] === 'da-doi';
  return (
    <>
      {passwordChanged && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-900"
        >
          Đã đổi mật khẩu. Vui lòng đăng nhập lại.
        </p>
      )}
      <AuthForm mode="login" />
    </>
  );
}
