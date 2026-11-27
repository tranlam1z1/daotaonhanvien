import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PermissionContext, SessionIdentity } from '../auth/permissions';

export async function uploadScope(
  db: Prisma.TransactionClient,
  tenantId: string,
  rawDepartmentId: unknown,
): Promise<PermissionContext | null> {
  if (rawDepartmentId === undefined) return { tenantId };
  if (
    typeof rawDepartmentId !== 'string' ||
    !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(rawDepartmentId)
  )
    throw new BadRequestException('Mã phòng ban không hợp lệ.');
  const departmentId = rawDepartmentId.toLowerCase();
  const department = await db.department.findFirst({
    where: { tenantId, id: departmentId, deletedAt: null, status: 'ACTIVE' },
    select: { id: true },
  });
  return department && { tenantId, departmentIds: [department.id] };
}

/** An editor can link their uploads or keep files already on authorized content. */
export function attachableFileWhere(
  actor: SessionIdentity,
  retained: string[],
): Prisma.FileObjectWhereInput {
  return {
    tenantId: actor.tenantId!,
    OR: [{ createdBy: actor.id }, { id: { in: retained } }],
  };
}
