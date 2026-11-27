import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

/** Bootstrap only: use a disposable test DB or privileged local seed account. */
export async function createTenantFixture(
  prisma: PrismaClient,
  passwordHash: string,
  prefix: string = randomUUID(),
) {
  const tenantId = randomUUID();
  return prisma.$transaction(async (tx) => {
    await tx.tenant.create({
      data: {
        id: tenantId,
        tenantId,
        name: `Doanh nghiệp ${prefix}`,
        loginCode: prefix,
      },
    });
    const department = await tx.department.create({
      data: { tenantId, name: 'Vận hành' },
    });
    const position = await tx.position.create({
      data: { tenantId, name: 'Nhân viên' },
    });
    const users = [];
    for (const index of [0, 1, 2]) {
      const user = await tx.user.create({
        data: {
          tenantId,
          employeeCode: `NV00${index + 1}`,
          fullName:
            index === 0 ? 'Quản trị doanh nghiệp' : `Nhân viên ${index}`,
          email: `${index === 0 ? 'adm' : `nv${index}`}@${prefix}.example`,
          passwordHash,
          status: 'ACTIVE',
          departmentId: department.id,
          positionId: position.id,
          roles: { create: { tenantId, role: index === 0 ? 'ADM' : 'NV' } },
        },
      });
      users.push(user);
    }
    return { tenantId, department, position, users };
  });
}

export async function removeTenantFixture(
  prisma: PrismaClient,
  tenantId: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({ where: { tenantId } });
    await tx.payment.deleteMany({ where: { tenantId } });
    await tx.subscription.deleteMany({ where: { tenantId } });
    await tx.userRole.deleteMany({ where: { tenantId } });
    await tx.user.deleteMany({ where: { tenantId } });
    await tx.department.deleteMany({ where: { tenantId } });
    await tx.position.deleteMany({ where: { tenantId } });
    await tx.tenant.delete({ where: { id: tenantId } });
  });
}
