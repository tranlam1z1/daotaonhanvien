import type { Metadata } from 'next';
import { AuthForm } from '../../../components/auth/AuthForm';

export const metadata: Metadata = { title: 'Đặt lại mật khẩu | EduCore36' };

export default function ResetPasswordPage() {
  return <AuthForm mode="reset-password" />;
}
