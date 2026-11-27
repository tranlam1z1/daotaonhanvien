import type { Metadata } from 'next';
import { AuthForm } from '../../../components/auth/AuthForm';

export const metadata: Metadata = { title: 'Quên mật khẩu | EduCore36' };

export default function ForgotPasswordPage() {
  return <AuthForm mode="forgot-password" />;
}
