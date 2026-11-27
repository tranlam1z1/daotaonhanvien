import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { can, type SessionIdentity } from '../auth/permissions';
import { TenantDatabase } from '../tenant/tenant-database';
import { extractDocumentText } from './document-text';
import { uploadScope } from './file-access';
import {
  bytesPerStorageGb,
  validateFile,
  type DiskUpload,
} from './file-policy';
import { ObjectStorage } from './object-storage';

const publicFields = {
  id: true,
  name: true,
  contentType: true,
  sizeBytes: true,
} as const;

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(ObjectStorage) private readonly storage: ObjectStorage,
  ) {}

  async upload(
    actor: SessionIdentity,
    file: DiskUpload,
    departmentId: unknown,
  ) {
    const tenantId = actor.tenantId;
    if (!tenantId)
      throw new ForbiddenException('Bạn không có quyền tải tệp lên.');
    const metadata = await validateFile(file);
    await this.database.run(tenantId, () =>
      this.checkQuota(tenantId, metadata.sizeBytes),
    );
    const searchText = await extractDocumentText(file.path, metadata);

    const id = randomUUID();
    const storageKey = `${tenantId}/${id}`;
    try {
      await this.storage.upload(
        storageKey,
        file.path,
        file.size,
        metadata.contentType,
      );
    } catch {
      // PUT can fail after the object store receives the body.
      await this.discard(storageKey);
      throw new ServiceUnavailableException(
        'Không thể lưu tệp. Vui lòng thử lại.',
      );
    }

    try {
      const saved = await this.database.run(tenantId, async () => {
        const db = this.database.client;
        // Subscription changes and successful concurrent uploads share this tenant row lock.
        await db.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
        await this.checkUploader(actor.id, tenantId, departmentId);
        await this.checkQuota(tenantId, metadata.sizeBytes);
        const record = await db.fileObject.create({
          data: {
            ...metadata,
            id,
            tenantId,
            storageKey,
            searchText,
            createdBy: actor.id,
          },
          select: publicFields,
        });
        await db.tenant.update({
          where: { tenantId },
          data: { storageUsedBytes: { increment: metadata.sizeBytes } },
          select: { id: true },
        });
        return record;
      });
      return { ...saved, sizeBytes: saved.sizeBytes.toString() };
    } catch (error) {
      // Confirm the result before removing an object if commit acknowledgement was lost.
      const saved = await this.database
        .run(tenantId, () =>
          this.database.client.fileObject.findUnique({
            where: { tenantId_id: { tenantId, id } },
            select: publicFields,
          }),
        )
        .catch(() => undefined);
      if (saved) return { ...saved, sizeBytes: saved.sizeBytes.toString() };
      if (saved === null) await this.discard(storageKey);
      else this.logger.warn('Could not confirm file transaction completion');
      throw error;
    }
  }

  /**
   * For content read handlers inside TenantDatabase.run. The resolver must
   * check the content's read permission and return its persisted file link.
   */
  async downloadForContent(
    actor: SessionIdentity,
    resolveAuthorizedLink: (
      db: Prisma.TransactionClient,
      actor: SessionIdentity,
    ) => Promise<string | null>,
    disposition: 'attachment' | 'inline' = 'attachment',
  ) {
    const notFound = () => new NotFoundException('Không tìm thấy tệp.');
    if (!actor.tenantId) throw notFound();
    const db = this.database.client;
    const fileId = await resolveAuthorizedLink(db, actor);
    if (!fileId) throw notFound();
    const file = await db.fileObject.findUnique({
      where: { tenantId_id: { tenantId: actor.tenantId, id: fileId } },
      select: { storageKey: true, name: true, contentType: true },
    });
    if (!file) throw notFound();
    try {
      return await (disposition === 'inline' &&
      (file.contentType === 'application/pdf' ||
        file.contentType.startsWith('video/'))
        ? this.storage.signDownload(file, disposition)
        : this.storage.signDownload(file));
    } catch {
      throw new ServiceUnavailableException(
        'Không thể cấp đường dẫn tải tệp. Vui lòng thử lại.',
      );
    }
  }

  private async checkUploader(
    id: string,
    tenantId: string,
    departmentId: unknown,
  ) {
    const db = this.database.client;
    const scope = await uploadScope(db, tenantId, departmentId);
    const uploader = await db.user.findFirst({
      where: { id, tenantId, deletedAt: null, invitationRequired: false },
      select: {
        id: true,
        status: true,
        roles: {
          where: { deletedAt: null, tenantId },
          select: { role: true, departmentIds: true },
        },
      },
    });
    if (
      !scope ||
      !uploader ||
      !can(
        { ...uploader, tenantId, hasDirectReports: false },
        'content.edit',
        scope,
      )
    )
      throw new ForbiddenException('Bạn không có quyền tải tệp lên.');
  }

  private async checkQuota(tenantId: string, size: bigint) {
    const db = this.database.client;
    const tenant = await db.tenant.findFirst({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { storageUsedBytes: true },
    });
    if (!tenant)
      throw new ForbiddenException('Doanh nghiệp không có quyền tải tệp lên.');
    const subscription = await db.subscription.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'EXPIRED'] },
      },
      orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
      select: { plan: { select: { storageGb: true } } },
    });
    if (!subscription)
      throw new ConflictException('Doanh nghiệp chưa có gói thuê bao lưu trữ.');
    const capacity = BigInt(subscription.plan.storageGb) * bytesPerStorageGb;
    if (tenant.storageUsedBytes + size > capacity)
      throw new ConflictException(
        'Tệp vượt dung lượng lưu trữ của gói thuê bao.',
      );
  }

  private async discard(storageKey: string) {
    try {
      await this.storage.remove(storageKey);
    } catch {
      this.logger.warn(
        'Could not remove unregistered file from object storage',
      );
    }
  }
}
