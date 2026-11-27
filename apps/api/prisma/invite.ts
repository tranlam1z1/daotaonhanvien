import 'reflect-metadata';
import 'dotenv/config';
import { AuthMailer } from '../src/auth/auth-mailer';
import { AuthService } from '../src/auth/auth.service';
import { TenantDatabase } from '../src/tenant/tenant-database';

async function main() {
  const [companyCode, email] = process.argv.slice(2);
  if (!companyCode || !email) {
    console.error(
      'Cách dùng: pnpm --filter @educore36/api auth:invite <mã doanh nghiệp> <email>',
    );
    process.exitCode = 1;
    return;
  }
  const database = new TenantDatabase();
  const mailer = new AuthMailer();
  try {
    if (!(await new AuthService(database, mailer).invite(email, companyCode))) {
      throw new Error('Invitation could not be sent');
    }
    console.log('Đã gửi email mời kích hoạt tài khoản.');
  } finally {
    mailer.onModuleDestroy();
    await database.onModuleDestroy();
  }
}

void main().catch(() => {
  console.error(
    'Không thể gửi lời mời. Kiểm tra tài khoản chờ kích hoạt và cấu hình SMTP.',
  );
  process.exitCode = 1;
});
