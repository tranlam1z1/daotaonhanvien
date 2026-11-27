import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createSmtpTransport, smtpFrom } from '../smtp';
import { webOrigin } from './auth-policy';

@Injectable()
export class AuthMailer implements OnModuleDestroy {
  private readonly transport = createSmtpTransport();

  async send(to: string, kind: 'RESET' | 'INVITE', token: string) {
    const url = new URL('/dat-lai-mat-khau', webOrigin());
    url.hash = new URLSearchParams({
      token,
      ...(kind === 'INVITE' ? { mode: 'invite' } : {}),
    }).toString();
    const invitation = kind === 'INVITE';
    await this.transport.sendMail({
      from: smtpFrom(),
      to,
      subject: invitation
        ? 'EduCore36 – Mời kích hoạt tài khoản'
        : 'EduCore36 – Đặt lại mật khẩu',
      text: invitation
        ? 'Đặt mật khẩu để kích hoạt tài khoản EduCore36 của bạn:\n\n' +
          url.href
        : 'Đặt lại mật khẩu EduCore36 của bạn. Đường dẫn chỉ dùng một lần và hết hạn sau 60 phút:\n\n' +
          url.href,
    });
  }

  onModuleDestroy() {
    this.transport.close();
  }
}
