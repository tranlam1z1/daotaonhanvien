import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash, argon2id } from 'argon2';
import { createTenantFixture } from '../src/testing/tenant-fixture';

const prisma = new PrismaClient();
async function seed() {
  const passwordHash = await hash(
    process.env.SEED_PASSWORD ?? 'EduCore36Local!',
    { type: argon2id },
  );
  await prisma.user.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      fullName: 'Quản trị nền tảng',
      email: 'qtnt@educore36.local',
      passwordHash,
      status: 'ACTIVE',
      roles: { create: { role: 'QTNT' } },
    },
  });
  await prisma.plan.upsert({
    where: { id: '00000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Gói mẫu',
      maxAccounts: 100,
      storageGb: 10,
      price: 0,
      cycle: 'MONTHLY',
    },
  });
  for (const code of ['demo-a', 'demo-b']) {
    const existing = await prisma.tenant.findUnique({
      where: { loginCode: code },
    });
    const tenantId =
      existing?.id ??
      (await createTenantFixture(prisma, passwordHash, code)).tenantId;
    await prisma.$transaction(async (tx) => {
      const manager = await tx.user.findUniqueOrThrow({
        where: { tenantId_email: { tenantId, email: `nv1@${code}.example` } },
      });
      await tx.user.updateMany({
        where: { tenantId, email: `nv2@${code}.example`, managerId: null },
        data: { managerId: manager.id },
      });

      for (const account of [
        { prefix: 'ptdt', fullName: 'Phụ trách đào tạo', role: 'PTDT' },
        { prefix: 'pd', fullName: 'Người phê duyệt', role: 'PD' },
      ] as const) {
        const email = `${account.prefix}@${code}.example`;
        await tx.user.upsert({
          where: { tenantId_email: { tenantId, email } },
          update: {},
          create: {
            tenantId,
            fullName: account.fullName,
            email,
            passwordHash,
            status: 'ACTIVE',
            roles: { create: { tenantId, role: account.role } },
          },
        });
      }
    });
  }
  console.log('Đã khởi tạo dữ liệu mẫu.');
}
seed()
  .catch(() => {
    console.error(
      'Không thể khởi tạo dữ liệu mẫu. Kiểm tra quyền bootstrap và kết nối CSDL.',
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
