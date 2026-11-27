import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, type KnowledgeAudience } from '@prisma/client';
import {
  can,
  permissionProfile,
  type SessionIdentity,
} from '../auth/permissions';
import { attachableFileWhere } from '../files/file-access';
import { FilesService } from '../files/files.service';
import { readConfig } from '../organization/organization-input';
import { TenantDatabase } from '../tenant/tenant-database';
import {
  draftInput,
  reviewInput,
  knowledgeText,
  type readerFilters,
  sanitizeKnowledgeHtml,
  taxonomyInput,
} from './knowledge-input';

type ContentPermission = 'content.edit' | 'content.approve';

export function contentContext(
  actor: SessionIdentity,
  permission: ContentPermission,
) {
  const grant = permissionProfile(actor).find(
    (grant) => grant.permission === permission,
  );
  return actor.tenantId && grant
    ? {
        tenantId: actor.tenantId,
        departmentIds:
          grant.scope === 'departments' ? grant.departmentIds : undefined,
      }
    : null;
}

export function editorContext(actor: SessionIdentity) {
  return contentContext(actor, 'content.edit');
}

const labels = { id: true, name: true } as const;
const draftFields = {
  id: true,
  itemId: true,
  revision: true,
  status: true,
  createdBy: true,
  rejectionReason: true,
  reviewToken: true,
  title: true,
  audience: true,
  departmentIds: true,
  updatedAt: true,
} as const;
const versionFields = {
  ...draftFields,
  summary: true,
  bodyHtml: true,
  categoryId: true,
  tagIds: true,
  positionIds: true,
  videoUrl: true,
  attachments: {
    select: {
      video: true,
      file: { select: { id: true, name: true, contentType: true } },
    },
  },
} satisfies Prisma.KnowledgeVersionSelect;

const publicationStatuses = ['PUBLISHED', 'ARCHIVED'] as const;
const publicationFields = {
  id: true,
  itemId: true,
  revision: true,
  status: true,
  title: true,
  audience: true,
  departmentIds: true,
  positionIds: true,
  updatedAt: true,
} as const;

function missing() {
  return new NotFoundException('Không tìm thấy nội dung tri thức.');
}

function editable(
  actor: SessionIdentity,
  scope: {
    tenantId: string;
    audience: KnowledgeAudience;
    departmentIds: string[];
  },
  permission: ContentPermission = 'content.edit',
) {
  return can(actor, permission, {
    tenantId: scope.tenantId,
    departmentIds: scope.audience === 'DEPARTMENTS' ? scope.departmentIds : [],
  });
}

@Injectable()
export class KnowledgeService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}
  private get db() {
    return this.database.client;
  }

  async editor(actor: SessionIdentity) {
    const scope = { tenantId: actor.tenantId!, deletedAt: null };
    const grant = contentContext(actor, 'content.edit');
    const departmentIds = grant?.departmentIds;
    const [categories, tags, departments, positions, candidates, selfApproval] =
      await Promise.all([
        this.db.knowledgeCategory.findMany({
          where: scope,
          select: { ...labels, parentId: true },
          orderBy: { name: 'asc' },
        }),
        this.db.knowledgeTag.findMany({
          where: scope,
          select: labels,
          orderBy: { name: 'asc' },
        }),
        this.db.department.findMany({
          where: {
            ...scope,
            status: 'ACTIVE',
            id: departmentIds && { in: departmentIds },
          },
          select: labels,
          orderBy: { name: 'asc' },
        }),
        departmentIds
          ? Promise.resolve([])
          : this.db.position.findMany({
              where: { ...scope, status: 'ACTIVE' },
              select: labels,
              orderBy: { name: 'asc' },
            }),
        this.db.knowledgeVersion.findMany({
          where: {
            tenantId: scope.tenantId,
            status: { in: ['DRAFT', 'IN_REVIEW'] },
            ...(departmentIds && {
              audience: 'DEPARTMENTS',
              departmentIds: { hasSome: departmentIds },
            }),
          },
          select: draftFields,
          orderBy: { updatedAt: 'desc' },
        }),
        this.selfApproval(scope.tenantId),
      ]);
    const drafts = candidates.filter((version) =>
      editable(actor, { ...version, tenantId: scope.tenantId }),
    );
    return {
      categories,
      tags,
      departments,
      positions,
      drafts: drafts
        .filter(({ status }) => status === 'DRAFT')
        .map((version) => this.workflowVersion(actor, version, selfApproval)),
      pending: drafts
        .filter(({ status }) => status === 'IN_REVIEW')
        .map((version) => this.workflowVersion(actor, version, selfApproval)),
      manageTaxonomy: !departmentIds,
    };
  }

  async draft(actor: SessionIdentity, id: string) {
    const version = await this.loadDraft(actor, id);
    return this.workflowVersion(
      actor,
      version,
      await this.selfApproval(actor.tenantId!),
    );
  }

  async saveDraft(actor: SessionIdentity, input: unknown, id?: string) {
    const { fileIds, videoFileId, ...data } = draftInput(input);
    const tenantId = actor.tenantId!;
    const author = await this.lockEditor(actor);
    const current = id ? await this.loadDraft(author, id) : null;
    if (!editable(author, { ...data, tenantId }))
      throw new ForbiddenException(
        'Bạn không có quyền soạn thảo trong phạm vi này.',
      );
    const scope = { tenantId, deletedAt: null };
    const requestedFiles = videoFileId ? [...fileIds, videoFileId] : fileIds;
    const retained = current?.attachments.map(({ file }) => file.id) ?? [];
    const [category, tags, departments, positions, files] = await Promise.all([
      data.categoryId
        ? this.db.knowledgeCategory.count({
            where: { ...scope, id: data.categoryId },
          })
        : 1,
      this.db.knowledgeTag.count({
        where: { ...scope, id: { in: data.tagIds } },
      }),
      this.db.department.count({
        where: { ...scope, status: 'ACTIVE', id: { in: data.departmentIds } },
      }),
      this.db.position.count({
        where: { ...scope, status: 'ACTIVE', id: { in: data.positionIds } },
      }),
      this.db.fileObject.findMany({
        where: {
          ...attachableFileWhere(actor, retained),
          id: { in: requestedFiles },
        },
        select: { id: true, contentType: true },
      }),
    ]);
    if (
      !category ||
      tags !== data.tagIds.length ||
      departments !== data.departmentIds.length ||
      positions !== data.positionIds.length
    )
      throw new BadRequestException(
        'Danh mục, thẻ hoặc phạm vi truy cập không hợp lệ.',
      );
    if (
      files.length !== requestedFiles.length ||
      files.some(
        ({ id, contentType }) =>
          contentType.startsWith('video/') !== (id === videoFileId),
      )
    )
      throw new BadRequestException('Tệp đính kèm hoặc video không hợp lệ.');

    const itemId =
      id ??
      (
        await this.db.knowledgeItem.create({
          data: { tenantId, createdBy: actor.id },
          select: { id: true },
        })
      ).id;
    const version = current
      ? await this.db.knowledgeVersion.update({
          where: { id: current.id },
          data,
          select: { id: true },
        })
      : await this.db.knowledgeVersion.create({
          data: { ...data, tenantId, itemId, createdBy: actor.id },
          select: { id: true },
        });
    if (current)
      await this.db.knowledgeAttachment.deleteMany({
        where: { tenantId, versionId: version.id },
      });
    if (requestedFiles.length)
      await this.db.knowledgeAttachment.createMany({
        data: requestedFiles.map((fileId) => ({
          tenantId,
          versionId: version.id,
          fileId,
          video: fileId === videoFileId,
        })),
      });
    return this.draft(author, itemId);
  }

  async downloadDraft(actor: SessionIdentity, itemId: string, fileId: string) {
    return this.files.downloadForContent(actor, async () => {
      const draft = await this.loadDraft(actor, itemId);
      return draft.attachments.some(({ file }) => file.id === fileId)
        ? fileId
        : null;
    });
  }

  async startRevision(
    actor: SessionIdentity,
    itemId: string,
    versionId: string,
  ) {
    const author = await this.lockEditor(actor);
    const tenantId = author.tenantId!;
    const current = await this.managedPublication(author, itemId);
    if (current.status !== 'PUBLISHED' || current.id !== versionId)
      throw new ConflictException(
        'Bản xuất bản đã thay đổi. Vui lòng tải lại.',
      );
    const versions = { tenantId, itemId };
    const latest = await this.db.knowledgeVersion.findFirstOrThrow({
      where: versions,
      orderBy: { revision: 'desc' },
      select: { revision: true, status: true },
    });
    if (latest.status === 'DRAFT' || latest.status === 'IN_REVIEW')
      throw new ConflictException(
        'Bài này đã có phiên bản đang soạn hoặc chờ duyệt.',
      );
    const source = await this.db.knowledgeVersion.findUniqueOrThrow({
      where: { id: current.id },
      select: {
        title: true,
        summary: true,
        bodyHtml: true,
        categoryId: true,
        tagIds: true,
        audience: true,
        departmentIds: true,
        positionIds: true,
        videoUrl: true,
        attachments: { select: { fileId: true, video: true } },
      },
    });
    const { attachments, ...data } = source;
    const draft = await this.db.knowledgeVersion.create({
      data: {
        ...data,
        ...versions,
        createdBy: author.id,
        revision: latest.revision + 1,
        attachments: { createMany: { data: attachments } },
      },
      select: versionFields,
    });
    return this.workflowVersion(
      author,
      draft,
      await this.selfApproval(tenantId),
    );
  }

  async reviewQueue(actor: SessionIdentity) {
    const tenantId = actor.tenantId!;
    const [versions, selfApproval] = await Promise.all([
      this.db.knowledgeVersion.findMany({
        where: { tenantId, status: 'IN_REVIEW' },
        select: draftFields,
        orderBy: { updatedAt: 'asc' },
      }),
      this.selfApproval(tenantId),
    ]);
    return versions
      .filter((version) =>
        editable(actor, { tenantId, ...version }, 'content.approve'),
      )
      .map((version) => this.workflowVersion(actor, version, selfApproval));
  }

  async previewVersion(
    actor: SessionIdentity,
    id: string,
    permission: ContentPermission,
  ) {
    const version = await this.loadWorkflowVersion(actor, id, permission);
    if (version.status !== 'IN_REVIEW') throw missing();
    const tenantId = actor.tenantId!;
    const scope =
      version.audience === 'DEPARTMENTS'
        ? this.db.department.findMany({
            where: { tenantId, id: { in: version.departmentIds } },
            select: { name: true },
          })
        : this.db.position.findMany({
            where: { tenantId, id: { in: version.positionIds } },
            select: { name: true },
          });
    const [scopeLabels, selfApproval] = await Promise.all([
      scope,
      this.selfApproval(tenantId),
    ]);
    return {
      ...this.workflowVersion(actor, version, selfApproval),
      scopeLabels: scopeLabels.map(({ name }) => name),
    };
  }

  async downloadReview(
    actor: SessionIdentity,
    id: string,
    fileId: string,
    permission: ContentPermission,
  ) {
    return this.files.downloadForContent(actor, async () => {
      const version = await this.previewVersion(actor, id, permission);
      return version.attachments.some(({ file }) => file.id === fileId)
        ? fileId
        : null;
    });
  }

  async authorAction(
    actor: SessionIdentity,
    id: string,
    action: 'submit' | 'withdraw' | 'publish',
    body: unknown,
    ip?: string,
  ) {
    const author = await this.lockEditor(actor);
    const version = await this.loadWorkflowVersion(author, id, 'content.edit');
    const tenantId = author.tenantId!;
    if (version.createdBy !== author.id)
      throw new ForbiddenException(
        'Chỉ người tạo phiên bản được thực hiện thao tác này.',
      );
    const selfApproval = await this.selfApproval(tenantId);
    if (action === 'withdraw') {
      this.assertReview(version, reviewInput(body).token);
      const updated = await this.db.knowledgeVersion.update({
        where: { id },
        data: { status: 'DRAFT', reviewToken: null },
        select: versionFields,
      });
      return this.workflowVersion(author, updated, selfApproval);
    }
    if (version.status !== 'DRAFT') throw this.invalidTransition();
    if (action === 'publish') {
      if (
        !selfApproval ||
        !editable(author, { tenantId, ...version }, 'content.approve')
      )
        throw new ForbiddenException(
          'Bạn không có quyền tự xuất bản phiên bản này.',
        );
      return this.recordDecision(author, version, null, selfApproval, ip);
    }
    const updated = await this.db.knowledgeVersion.update({
      where: { id },
      data: {
        status: 'IN_REVIEW',
        reviewToken: randomUUID(),
        rejectionReason: null,
      },
      select: versionFields,
    });
    return this.workflowVersion(author, updated, selfApproval);
  }

  async decide(
    actor: SessionIdentity,
    id: string,
    reject: boolean,
    body: unknown,
    ip?: string,
  ) {
    const reviewer = await this.lockEditor(actor, false, 'content.approve');
    const version = await this.loadWorkflowVersion(
      reviewer,
      id,
      'content.approve',
    );
    const { token, reason } = reviewInput(body, reject);
    this.assertReview(version, token);
    const selfApproval = await this.selfApproval(reviewer.tenantId!);
    if (!reject && !selfApproval && version.createdBy === reviewer.id)
      throw new ForbiddenException('Doanh nghiệp chưa bật quyền tự phê duyệt.');
    return this.recordDecision(reviewer, version, reason, selfApproval, ip);
  }

  rejections(actor: SessionIdentity) {
    return this.db.knowledgeRejection.findMany({
      where: { tenantId: actor.tenantId!, userId: actor.id },
      select: { id: true, title: true, reason: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async recordDecision(
    actor: SessionIdentity,
    version: Prisma.KnowledgeVersionGetPayload<{
      select: typeof versionFields;
    }>,
    reason: string | null,
    selfApproval: boolean,
    ip?: string,
  ) {
    const tenantId = actor.tenantId!;
    const updated = await this.db.knowledgeVersion.update({
      where: { id: version.id },
      data: {
        status: reason ? 'DRAFT' : 'PUBLISHED',
        reviewToken: null,
        rejectionReason: reason,
      },
      select: versionFields,
    });
    if (reason)
      await this.db.knowledgeRejection.create({
        data: {
          tenantId,
          userId: version.createdBy,
          versionId: version.id,
          title: version.title,
          reason,
        },
      });
    await this.db.auditLog.create({
      data: {
        tenantId,
        userId: actor.id,
        action: reason ? 'knowledge.reject' : 'knowledge.approve',
        objectType: 'KnowledgeVersion',
        objectId: version.id,
        before: { status: version.status },
        after: {
          status: updated.status,
          reason,
          selfApproved: !reason && actor.id === version.createdBy,
        },
        ip,
      },
    });
    return this.workflowVersion(actor, updated, selfApproval);
  }

  private async loadWorkflowVersion(
    actor: SessionIdentity,
    id: string,
    permission: ContentPermission,
  ) {
    const tenantId = actor.tenantId!;
    const version = await this.db.knowledgeVersion.findFirst({
      where: { tenantId, id },
      select: versionFields,
    });
    if (!version || !editable(actor, { tenantId, ...version }, permission))
      throw missing();
    return version;
  }

  private async selfApproval(tenantId: string) {
    const tenant = await this.db.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { config: true },
    });
    return readConfig(tenant.config).selfApproval;
  }

  private invalidTransition() {
    return new ConflictException(
      'Trạng thái phiên bản đã thay đổi. Vui lòng mở lại bài.',
    );
  }

  private assertReview(
    version: { status: string; reviewToken: string | null },
    token: string,
  ) {
    if (version.status !== 'IN_REVIEW' || version.reviewToken !== token)
      throw this.invalidTransition();
  }

  private workflowVersion<
    T extends Prisma.KnowledgeVersionGetPayload<{
      select: typeof draftFields;
    }> & { bodyHtml?: string },
  >(actor: SessionIdentity, version: T, selfApproval: boolean) {
    const { createdBy, ...result } = version;
    const own = createdBy === actor.id;
    const canApprove = editable(
      actor,
      { ...version, tenantId: actor.tenantId! },
      'content.approve',
    );
    return {
      ...result,
      ...(version.bodyHtml !== undefined && {
        bodyHtml: sanitizeKnowledgeHtml(version.bodyHtml),
      }),
      canSubmit: own && version.status === 'DRAFT',
      canWithdraw: own && version.status === 'IN_REVIEW',
      canPublish:
        own && version.status === 'DRAFT' && selfApproval && canApprove,
      canApprove: canApprove && (!own || selfApproval),
    };
  }

  async readers(
    actor: SessionIdentity,
    filters: ReturnType<typeof readerFilters>,
  ) {
    const tenantId = actor.tenantId!;
    const scope = { tenantId, deletedAt: null };
    const [reader, items, categories, tags, departments] = await Promise.all([
      this.readerProfile(actor),
      this.currentItems(tenantId, undefined, {
        categoryId: true,
        tagIds: true,
        summary: true,
        bodyHtml: !!filters.keyword,
      }),
      this.db.knowledgeCategory.findMany({
        where: scope,
        select: { ...labels, parentId: true },
        orderBy: { name: 'asc' },
      }),
      this.db.knowledgeTag.findMany({
        where: scope,
        select: labels,
        orderBy: { name: 'asc' },
      }),
      this.db.department.findMany({
        where: { ...scope, status: 'ACTIVE' },
        select: labels,
        orderBy: { name: 'asc' },
      }),
    ]);
    const keyword = this.searchValue(filters.keyword);
    const articles = items.flatMap(({ versions: [version] }) => {
      if (
        !this.readerCanSee(reader, version) ||
        (filters.categoryId && version.categoryId !== filters.categoryId) ||
        (filters.tagId && !version.tagIds.includes(filters.tagId)) ||
        (filters.departmentId &&
          (version.audience !== 'DEPARTMENTS' ||
            !version.departmentIds.includes(filters.departmentId))) ||
        (keyword &&
          ![
            version.title,
            version.summary,
            knowledgeText(version.bodyHtml),
          ].some((value) => this.searchValue(value).includes(keyword)))
      )
        return [];
      const { itemId, title, summary, updatedAt } = version;
      return [{ itemId, title, summary, updatedAt }];
    });
    articles.sort(
      (a, b) =>
        b.updatedAt.getTime() - a.updatedAt.getTime() ||
        a.itemId.localeCompare(b.itemId),
    );
    return { articles, categories, tags, departments };
  }

  async reader(actor: SessionIdentity, itemId: string) {
    const [reader, [item]] = await Promise.all([
      this.readerProfile(actor),
      this.currentItems(actor.tenantId!, itemId, versionFields),
    ]);
    const version = item?.versions[0];
    if (!this.readerCanSee(reader, version)) throw missing();
    return this.publicationDetail(version);
  }

  async downloadPublished(
    actor: SessionIdentity,
    itemId: string,
    fileId: string,
  ) {
    return this.files.downloadForContent(actor, async () => {
      const version = await this.reader(actor, itemId);
      return version.attachments.some(({ file }) => file.id === fileId)
        ? fileId
        : null;
    });
  }

  async publications(actor: SessionIdentity) {
    const tenantId = actor.tenantId!;
    const items = await this.currentItems(tenantId, undefined, {});
    return items.flatMap(({ versions: [version] }) =>
      version && editable(actor, { ...version, tenantId }) ? [version] : [],
    );
  }

  async publicationHistory(actor: SessionIdentity, itemId: string) {
    const tenantId = actor.tenantId!;
    await this.managedPublication(actor, itemId);
    const versions = await this.db.knowledgeVersion.findMany({
      where: { tenantId, itemId, status: { in: [...publicationStatuses] } },
      orderBy: { revision: 'desc' },
      select: publicationFields,
    });
    return versions.filter((version) =>
      editable(actor, { ...version, tenantId }),
    );
  }

  async historicalVersion(
    actor: SessionIdentity,
    itemId: string,
    versionId: string,
  ) {
    const tenantId = actor.tenantId!;
    await this.managedPublication(actor, itemId);
    const version = await this.db.knowledgeVersion.findFirst({
      where: {
        tenantId,
        itemId,
        id: versionId,
        status: { in: [...publicationStatuses] },
      },
      select: { ...publicationFields, ...versionFields },
    });
    if (!version || !editable(actor, { ...version, tenantId })) throw missing();
    return this.publicationDetail(version);
  }

  async downloadHistorical(
    actor: SessionIdentity,
    itemId: string,
    versionId: string,
    fileId: string,
  ) {
    return this.files.downloadForContent(actor, async () => {
      const version = await this.historicalVersion(actor, itemId, versionId);
      return version.attachments.some(({ file }) => file.id === fileId)
        ? fileId
        : null;
    });
  }

  async changePublication(
    actor: SessionIdentity,
    itemId: string,
    archive: boolean,
  ) {
    const current = await this.managedPublication(
      await this.lockEditor(actor),
      itemId,
    );
    const status = archive ? 'ARCHIVED' : 'PUBLISHED';
    if (current.status === status) return current;
    return this.db.knowledgeVersion.update({
      where: { id: current.id },
      data: { status },
      select: publicationFields,
    });
  }

  private currentItems<T extends Prisma.KnowledgeVersionSelect>(
    tenantId: string,
    itemId: string | string[] | undefined,
    fields: T,
  ) {
    const where = { tenantId, status: { in: [...publicationStatuses] } };
    return this.db.knowledgeItem.findMany({
      where: {
        tenantId,
        id: Array.isArray(itemId) ? { in: itemId } : itemId,
        versions: { some: where },
      },
      select: {
        versions: {
          where,
          orderBy: { revision: 'desc' },
          take: 1,
          select: { ...fields, ...publicationFields },
        },
      },
    });
  }

  private async managedPublication(actor: SessionIdentity, itemId: string) {
    const tenantId = actor.tenantId!;
    const [item] = await this.currentItems(tenantId, itemId, {});
    const version = item?.versions[0];
    if (!version || !editable(actor, { ...version, tenantId })) throw missing();
    return version;
  }

  private readerProfile(actor: SessionIdentity) {
    return this.db.user.findFirst({
      where: { tenantId: actor.tenantId!, id: actor.id, deletedAt: null },
      select: { departmentId: true, positionId: true },
    });
  }

  private readerCanSee<
    T extends Prisma.KnowledgeVersionGetPayload<{
      select: typeof publicationFields;
    }>,
  >(
    reader: { departmentId: string | null; positionId: string | null } | null,
    version?: T,
  ): version is T {
    return (
      !!reader &&
      version?.status === 'PUBLISHED' &&
      (version.audience === 'TENANT' ||
        (version.audience === 'DEPARTMENTS' &&
          !!reader.departmentId &&
          version.departmentIds.includes(reader.departmentId)) ||
        (version.audience === 'POSITIONS' &&
          !!reader.positionId &&
          version.positionIds.includes(reader.positionId)))
    );
  }

  private publicationDetail(
    version: Prisma.KnowledgeVersionGetPayload<{
      select: typeof versionFields;
    }>,
  ) {
    const { itemId, title, summary, bodyHtml, videoUrl, attachments } = version;
    return {
      itemId,
      title,
      summary,
      bodyHtml: sanitizeKnowledgeHtml(bodyHtml),
      videoUrl,
      attachments,
    };
  }

  private searchValue(value: string) {
    return value.normalize('NFC').toLocaleLowerCase('vi');
  }

  async readableTitles(actor: SessionIdentity, ids?: string[]) {
    const tenantId = actor.tenantId!;
    if (
      ids?.length === 0 ||
      !can(actor, 'knowledge.read', { tenantId, knowledgeVisible: true })
    )
      return [];
    const [reader, items] = await Promise.all([
      this.readerProfile(actor),
      this.currentItems(tenantId, ids, {}),
    ]);
    return items
      .flatMap(({ versions: [version] }) =>
        this.readerCanSee(reader, version)
          ? [{ id: version.itemId, name: version.title }]
          : [],
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }

  async saveTaxonomy(
    actor: SessionIdentity,
    kind: 'category' | 'tag',
    body: unknown,
    id?: string,
  ) {
    const { name, parentId } = taxonomyInput(body, kind === 'category');
    const tenantId = actor.tenantId!;
    await this.lockEditor(actor, true);
    const scope = { tenantId, deletedAt: null };
    if (kind === 'tag') {
      if (id) {
        if (!(await this.db.knowledgeTag.count({ where: { ...scope, id } })))
          throw missing();
        return this.db.knowledgeTag.update({
          where: { id },
          data: { name },
          select: labels,
        });
      }
      return this.db.knowledgeTag.create({
        data: { tenantId, name },
        select: labels,
      });
    }
    const categories = await this.db.knowledgeCategory.findMany({
      where: scope,
      select: { id: true, parentId: true },
    });
    const parents = new Map(
      categories.map((category) => [category.id, category.parentId]),
    );
    if (id && !parents.has(id)) throw missing();
    if (parentId && !parents.has(parentId))
      throw new BadRequestException('Danh mục cha không hợp lệ.');
    const visited = new Set([id]);
    for (
      let ancestor = parentId;
      ancestor;
      ancestor = parents.get(ancestor) ?? null
    ) {
      if (visited.has(ancestor))
        throw new BadRequestException('Danh mục cha tạo vòng lặp.');
      visited.add(ancestor);
    }
    const select = { ...labels, parentId: true };
    return id
      ? this.db.knowledgeCategory.update({
          where: { id },
          data: { name, parentId },
          select,
        })
      : this.db.knowledgeCategory.create({
          data: { tenantId, name, parentId },
          select,
        });
  }

  async deleteTaxonomy(
    actor: SessionIdentity,
    kind: 'category' | 'tag',
    id: string,
  ) {
    const tenantId = actor.tenantId!;
    await this.lockEditor(actor, true);
    const scope = { tenantId, deletedAt: null };
    const deletedAt = new Date();
    if (kind === 'category') {
      if (!(await this.db.knowledgeCategory.count({ where: { ...scope, id } })))
        throw missing();
      const [children, versions] = await Promise.all([
        this.db.knowledgeCategory.count({ where: { ...scope, parentId: id } }),
        this.db.knowledgeVersion.count({ where: { tenantId, categoryId: id } }),
      ]);
      if (children || versions)
        throw new ConflictException(
          'Danh mục đang có danh mục con hoặc bài tri thức.',
        );
      await this.db.knowledgeCategory.update({
        where: { id },
        data: { deletedAt },
      });
    } else {
      if (!(await this.db.knowledgeTag.count({ where: { ...scope, id } })))
        throw missing();
      if (
        await this.db.knowledgeVersion.count({
          where: { tenantId, tagIds: { has: id } },
        })
      )
        throw new ConflictException('Thẻ đang được sử dụng.');
      await this.db.knowledgeTag.update({ where: { id }, data: { deletedAt } });
    }
    return { id };
  }

  private async loadDraft(actor: SessionIdentity, itemId: string) {
    const tenantId = actor.tenantId!;
    const version = await this.db.knowledgeVersion.findFirst({
      where: { tenantId, itemId, status: 'DRAFT' },
      orderBy: { revision: 'desc' },
      select: versionFields,
    });
    if (!version || !editable(actor, { ...version, tenantId })) throw missing();
    return version;
  }

  async lockEditor(
    actor: SessionIdentity,
    entireTenant = false,
    permission: ContentPermission = 'content.edit',
  ) {
    const tenantId = actor.tenantId!;
    await this.db
      .$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
    const user = await this.db.user.findFirst({
      where: {
        tenantId,
        id: actor.id,
        deletedAt: null,
        invitationRequired: false,
        tenant: { status: 'ACTIVE', deletedAt: null },
      },
      select: {
        status: true,
        roles: {
          where: { tenantId, deletedAt: null },
          select: { role: true, departmentIds: true },
        },
      },
    });
    const fresh = user && { ...actor, ...user };
    const context = fresh && contentContext(fresh, permission);
    if (!fresh || !context || (entireTenant && context.departmentIds))
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện thao tác này.',
      );
    return fresh;
  }
}
