import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantDatabase } from '../tenant/tenant-database';
import {
  catalogInput,
  departmentParentInput,
  logoUrl,
  profileInput,
  readConfig,
  updateConfig,
} from './organization-input';

type Actor = { id: string; tenantId: string };
type Catalog = 'departments' | 'positions';

const profileFields = {
  name: true,
  logo: true,
  address: true,
  taxCode: true,
  contactName: true,
  contactPhone: true,
} as const;
const catalogFields = { id: true, name: true, status: true } as const;
const departmentFields = { ...catalogFields, parentId: true } as const;

@Injectable()
export class OrganizationService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  async dashboard({ tenantId }: Actor) {
    const db = this.database.client;
    const scope = { tenantId, deletedAt: null };
    const [tenant, departments, positions, plan, activeAccounts] =
      await Promise.all([
        db.tenant.findFirstOrThrow({
          where: scope,
          select: { ...profileFields, config: true, storageUsedBytes: true },
        }),
        db.department.findMany({
          where: scope,
          select: departmentFields,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
        db.position.findMany({
          where: scope,
          select: catalogFields,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
        db.subscription.findFirst({
          where: { ...scope, status: { in: ['ACTIVE', 'EXPIRED'] } },
          orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
          select: {
            endsAt: true,
            plan: {
              select: { name: true, maxAccounts: true, storageGb: true },
            },
          },
        }),
        db.user.count({
          where: { ...scope, status: { in: ['ACTIVE', 'HANDOVER'] } },
        }),
      ]);
    const { config, storageUsedBytes, ...profile } = tenant;
    return {
      profile: { ...profile, logo: logoUrl(profile.logo) },
      config: readConfig(config),
      departments,
      positions,
      subscription: {
        plan,
        activeAccounts,
        storageUsedBytes: storageUsedBytes.toString(),
      },
    };
  }

  async saveProfile({ id, tenantId }: Actor, body: unknown) {
    return this.database.client.tenant.update({
      where: { tenantId, deletedAt: null },
      data: { ...profileInput(body), updatedBy: id },
      select: profileFields,
    });
  }

  async saveConfig({ id, tenantId }: Actor, body: unknown) {
    await this.lockTenant(tenantId);
    const db = this.database.client;
    const current = await db.tenant.findFirstOrThrow({
      where: { tenantId, deletedAt: null },
      select: { config: true },
    });
    const tenant = await db.tenant.update({
      where: { tenantId, deletedAt: null },
      data: { config: updateConfig(current.config, body), updatedBy: id },
      select: { config: true },
    });
    return readConfig(tenant.config);
  }

  async saveCatalog(
    actor: Actor,
    catalog: Catalog,
    body: unknown,
    id?: string,
  ) {
    const { tenantId } = actor;
    const data = { ...catalogInput(body), updatedBy: actor.id };

    if (catalog === 'departments') {
      const requestedParent = departmentParentInput(body);
      await this.lockTenant(tenantId);
      const departments = this.database.client.department;
      const scope = { tenantId, deletedAt: null };
      const current = id
        ? await departments.findFirst({
            where: { ...scope, id },
            select: { parentId: true },
          })
        : null;
      if (id && !current) throw this.missingRecord();
      const parentId =
        requestedParent === undefined
          ? (current?.parentId ?? null)
          : requestedParent;
      if (parentId && current?.parentId !== parentId)
        await this.checkParent(tenantId, id, parentId);
      return id
        ? departments.update({
            where: { ...scope, id },
            data: { ...data, parentId },
            select: departmentFields,
          })
        : departments.create({
            data: { ...data, parentId, tenantId, createdBy: actor.id },
            select: departmentFields,
          });
    }

    const positions = this.database.client.position;
    if (!id)
      return positions.create({
        data: { ...data, tenantId, createdBy: actor.id },
        select: catalogFields,
      });
    const result = await positions.updateManyAndReturn({
      where: { tenantId, id, deletedAt: null },
      data,
      select: catalogFields,
    });
    if (!result.length) throw this.missingRecord();
    return result[0];
  }

  private async lockTenant(tenantId: string) {
    // Serialize updates that read the current configuration or tree before writing.
    await this.database.client.$queryRaw`
      SELECT id FROM tenants WHERE tenant_id = ${tenantId}::uuid FOR UPDATE
    `;
  }

  private async checkParent(
    tenantId: string,
    id: string | undefined,
    parentId: string,
  ) {
    const departments = await this.database.client.department.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, parentId: true, status: true },
    });
    const byId = new Map(
      departments.map((department) => [department.id, department]),
    );
    let parent = byId.get(parentId);
    if (!parent || parent.status !== 'ACTIVE')
      throw new BadRequestException(
        'Hãy chọn một phòng ban cấp trên đang hoạt động.',
      );
    const seen = new Set(id ? [id] : []);
    while (parent) {
      if (seen.has(parent.id))
        throw new ConflictException(
          'Di chuyển này sẽ tạo vòng lặp trong cây phòng ban.',
        );
      seen.add(parent.id);
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
  }

  private missingRecord() {
    return new NotFoundException('Không tìm thấy mục trong doanh nghiệp.');
  }
}
