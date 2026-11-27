import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuthOriginGuard, type SessionRequest } from '../auth/auth-http';
import { RequirePermission } from '../auth/authorization.guard';
import { can } from '../auth/permissions';
import { objectInput } from '../employees/employee-input';
import { FilesService } from '../files/files.service';
import { TenantDatabase } from '../tenant/tenant-database';

const categories = [
  'WORK',
  'DOCUMENT',
  'TOOL',
  'CONTACT',
  'EXPERIENCE',
] as const;
const employeeFields = {
  id: true,
  fullName: true,
  managerId: true,
  departmentId: true,
} as const;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

type Item = {
  id: string;
  category: (typeof categories)[number];
  title: string;
  description: string;
  recipientId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  reason: string;
  draftId?: string;
  files?: { id: string; name: string }[];
};
type Workflow = {
  status: 'DRAFT' | 'RECEIVING' | 'REVISION' | 'REVIEW' | 'COMPLETED';
  items: Item[];
  explanation?: string;
  substituteId?: string;
  substituteReason?: string;
  reviewReason?: string;
  appendices?: { userId: string; text: string; createdAt: string }[];
};

function workflow(value: Prisma.JsonValue): Workflow {
  if (value && typeof value === 'object' && 'status' in value)
    return value as Workflow;
  return { status: 'DRAFT', items: [] };
}

function field(value: unknown, max: number, required = true) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed.length > max || (required && !trimmed))
    throw new BadRequestException('Vui lòng kiểm tra nội dung hồ sơ bàn giao.');
  return trimmed;
}

function forbidden(): never {
  throw new ForbiddenException('Bạn không có quyền thao tác trên hồ sơ này.');
}

export async function handoverNotice(
  db: Prisma.TransactionClient,
  tenantId: string,
  userIds: (string | null | undefined)[],
  eventKey: string,
  message: string,
) {
  const recipients = [...new Set(userIds.filter((id): id is string => !!id))];
  if (recipients.length)
    await db.workspaceNotice.createMany({
      data: recipients.map((userId) => ({
        tenantId,
        userId,
        eventKey,
        message,
      })),
      skipDuplicates: true,
    });
}

@Controller('handovers')
export class HandoverController {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}

  @Get(':id/files/:fileId')
  @RequirePermission('session.profile')
  async download(
    @Req() request: SessionRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    const actor = request.user!;
    const url = await this.files.downloadForContent(actor, async (db) => {
      const tenantId = actor.tenantId!;
      const record = await db.handoverCase.findFirst({
        where: { id, tenantId },
        select: { workflow: true, employee: { select: employeeFields } },
      });
      if (!record) return null;
      const canPrepare = can(actor, 'handover.prepare', {
        tenantId,
        employee: record.employee,
      });
      return workflow(record.workflow).items.some(
        (item) =>
          (canPrepare || item.recipientId === actor.id) &&
          item.files?.some((file) => file.id === fileId),
      )
        ? fileId
        : null;
    });
    return { url };
  }

  @Get()
  @RequirePermission('session.profile')
  async list(@Req() request: SessionRequest) {
    const actor = request.user!;
    const tenantId = actor.tenantId;
    if (!tenantId) return forbidden();
    const db = this.database.client;
    const cases = await db.handoverCase.findMany({
      where: { tenantId },
      include: { employee: { select: employeeFields } },
      orderBy: { createdAt: 'desc' },
    });
    const visible = cases.flatMap(({ workflow: raw, ...record }) => {
      const state = workflow(raw);
      const context = { tenantId, employee: record.employee };
      const canPrepare = can(actor, 'handover.prepare', context);
      const canComplete = can(actor, 'handover.complete', context);
      if (canPrepare || canComplete)
        return [{ ...record, ...state, canPrepare, canComplete }];
      const items = state.items.filter(
        ({ recipientId }) => recipientId === actor.id,
      );
      return items.length
        ? [
            {
              ...record,
              status: state.status,
              items,
              canPrepare: false,
              canComplete: false,
            },
          ]
        : [];
    });
    const canStartTenant = can(actor, 'handover.start');
    const people = await db.user.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, fullName: true, managerId: true },
      orderBy: { fullName: 'asc' },
    });
    return {
      cases: visible,
      people: people
        .filter(
          (person) =>
            canStartTenant ||
            visible.some((record) => record.canPrepare) ||
            person.managerId === actor.id,
        )
        .map(({ id, fullName, managerId }) => ({
          id,
          fullName,
          canStart: can(actor, 'handover.start', {
            tenantId,
            employee: { id, managerId },
          }),
        })),
    };
  }

  @Post(':id/actions/:action')
  @RequirePermission('session.profile')
  @UseGuards(AuthOriginGuard)
  async change(
    @Req() request: SessionRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('action') action: string,
    @Body() input: unknown,
  ) {
    const actor = request.user!;
    const tenantId = actor.tenantId;
    if (!tenantId) return forbidden();
    const db = this.database.client;
    await db.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
    const record = await db.handoverCase.findFirst({
      where: { id, tenantId },
      include: { employee: { select: employeeFields } },
    });
    if (!record) throw new NotFoundException('Không tìm thấy hồ sơ bàn giao.');
    const state = workflow(record.workflow);
    const context = { tenantId, employee: record.employee };
    const body = objectInput(input);
    const invalid = () =>
      new ConflictException('Thao tác không phù hợp với trạng thái hồ sơ.');
    const event = `handover:${id}:${randomUUID()}`;
    const notify = (users: (string | null | undefined)[], message: string) =>
      handoverNotice(db, tenantId, users, event, message);
    const preparer = state.substituteId ?? record.employeeId;
    const manager = record.employee.managerId;
    const canComplete = can(actor, 'handover.complete', context);

    switch (action) {
      case 'submit': {
        if (!can(actor, 'handover.prepare', context)) return forbidden();
        if (state.status !== 'DRAFT' && state.status !== 'REVISION')
          throw invalid();
        if (actor.id !== record.employeeId) {
          state.substituteId = actor.id;
          state.substituteReason = field(body.substituteReason, 500);
        } else {
          delete state.substituteId;
          delete state.substituteReason;
        }
        const submitted = body.items;
        if (!Array.isArray(submitted) || submitted.length > 100)
          throw new BadRequestException('Danh sách hạng mục không hợp lệ.');
        const accepted = state.items.filter(
          ({ status }) => status === 'ACCEPTED',
        );
        const pending = submitted.map((value: unknown) => {
          const item = objectInput(value);
          const category = categories.find((entry) => entry === item.category);
          const recipientId = field(item.recipientId, 36).toLowerCase();
          if (
            !category ||
            !uuid.test(recipientId) ||
            recipientId === record.employeeId
          )
            throw new BadRequestException(
              'Loại hạng mục hoặc người nhận không hợp lệ.',
            );
          const requested = item.fileIds ?? [];
          if (
            !Array.isArray(requested) ||
            requested.length > 10 ||
            requested.some(
              (value: unknown) =>
                typeof value !== 'string' || !uuid.test(value),
            )
          )
            throw new BadRequestException('Tệp đính kèm không hợp lệ.');
          const result: Item = {
            id: randomUUID(),
            category,
            recipientId,
            title: field(item.title, 160),
            description: field(item.description, 10000),
            status: 'PENDING',
            reason: '',
          };
          return {
            result,
            fileIds: [
              ...new Set((requested as string[]).map((id) => id.toLowerCase())),
            ],
          };
        });
        const requestedFiles = [
          ...new Set(pending.flatMap(({ fileIds }) => fileIds)),
        ];
        const retained = state.items.flatMap(
          (item) => item.files?.map(({ id }) => id) ?? [],
        );
        const fileRecords = await db.fileObject.findMany({
          where: {
            tenantId,
            id: { in: requestedFiles },
            OR: [{ createdBy: actor.id }, { id: { in: retained } }],
          },
          select: { id: true, name: true },
        });
        if (fileRecords.length !== requestedFiles.length)
          throw new BadRequestException('Tệp đính kèm không hợp lệ.');
        const items = pending.map(({ result, fileIds }) => ({
          ...result,
          files: fileRecords.filter(({ id }) => fileIds.includes(id)),
        }));
        const recipients = [
          ...new Set(items.map(({ recipientId }) => recipientId)),
        ];
        if (
          (await db.user.count({
            where: {
              tenantId,
              id: { in: recipients },
              status: 'ACTIVE',
              deletedAt: null,
            },
          })) !== recipients.length
        )
          throw new BadRequestException(
            'Người nhận phải là nhân viên đang hoạt động trong doanh nghiệp.',
          );
        state.items = [...accepted, ...items];
        state.explanation = state.items.length
          ? ''
          : field(body.explanation, 1000);
        delete state.reviewReason;
        state.status = items.length ? 'RECEIVING' : 'REVIEW';
        if (items.length)
          await notify(
            recipients,
            `Bạn được chỉ định nhận bàn giao từ ${record.employee.fullName}.`,
          );
        else
          await notify(
            [manager],
            `Hồ sơ bàn giao của ${record.employee.fullName} đang chờ xác nhận.`,
          );
        break;
      }
      case 'accept':
      case 'reject': {
        const item = state.items.find((entry) => entry.id === body.itemId);
        if (
          !item ||
          !can(actor, 'handover.receive', {
            tenantId,
            recipientId: item.recipientId,
          })
        )
          return forbidden();
        if (
          !['RECEIVING', 'REVISION'].includes(state.status) ||
          item.status !== 'PENDING'
        )
          throw invalid();
        item.status = action === 'accept' ? 'ACCEPTED' : 'REJECTED';
        item.reason = action === 'reject' ? field(body.reason, 500) : '';
        if (action === 'reject') {
          state.status = 'REVISION';
          await notify(
            [preparer],
            `Hạng mục ${item.title} bị từ chối. Lý do: ${item.reason}`,
          );
        } else if (state.items.every(({ status }) => status === 'ACCEPTED')) {
          state.status = 'REVIEW';
          await notify(
            [manager],
            `Hồ sơ bàn giao của ${record.employee.fullName} đang chờ xác nhận.`,
          );
        }
        break;
      }
      case 'revise':
      case 'complete': {
        if (!canComplete) return forbidden();
        if (
          state.status !== 'REVIEW' ||
          state.items.some(({ status }) => status !== 'ACCEPTED')
        )
          throw invalid();
        if (action === 'revise') {
          state.reviewReason = field(body.reason, 500);
          state.status = 'REVISION';
          await notify(
            [preparer],
            `Quản lý yêu cầu bổ sung hồ sơ. Lý do: ${state.reviewReason}`,
          );
        } else {
          if (actor.id === record.employeeId) return forbidden();
          state.status = 'COMPLETED';
          await db.user.update({
            where: { id: record.employeeId },
            data: { status: 'DISABLED', updatedBy: actor.id },
          });
          await db.authCredential.deleteMany({
            where: { tenantId, userId: record.employeeId },
          });
          await notify(
            [
              record.employeeId,
              manager,
              ...state.items.map(({ recipientId }) => recipientId),
            ],
            `Hồ sơ bàn giao của ${record.employee.fullName} đã hoàn tất.`,
          );
        }
        break;
      }
      case 'append': {
        if (!canComplete) return forbidden();
        if (state.status !== 'COMPLETED') throw invalid();
        state.appendices = [
          ...(state.appendices ?? []),
          {
            userId: actor.id,
            text: field(body.text, 5000),
            createdAt: new Date().toISOString(),
          },
        ];
        break;
      }
      case 'draft': {
        const item = state.items.find((entry) => entry.id === body.itemId);
        if (
          !canComplete ||
          !can(actor, 'content.edit', {
            tenantId,
            departmentIds: [record.employee.departmentId],
          })
        )
          return forbidden();
        if (
          !item ||
          item.category !== 'EXPERIENCE' ||
          item.status !== 'ACCEPTED'
        )
          throw invalid();
        if (item.draftId) return { draftId: item.draftId };
        const departmentIds =
          !can(actor, 'content.edit', { tenantId }) &&
          record.employee.departmentId
            ? [record.employee.departmentId]
            : [];
        const draft = await db.knowledgeItem.create({
          data: { tenantId, createdBy: actor.id },
        });
        const escaped = item.description
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;');
        await db.knowledgeVersion.create({
          data: {
            tenantId,
            itemId: draft.id,
            createdBy: actor.id,
            title: item.title,
            summary: item.description.slice(0, 500),
            bodyHtml: `<p>${escaped.replaceAll('\n', '<br>')}</p>`,
            audience: departmentIds.length ? 'DEPARTMENTS' : 'TENANT',
            departmentIds,
          },
        });
        item.draftId = draft.id;
        break;
      }
      default:
        throw new NotFoundException('Thao tác bàn giao không tồn tại.');
    }
    await db.handoverCase.update({
      where: { id },
      data: {
        workflow: state,
        ...(action === 'complete' ? { completedAt: new Date() } : {}),
      },
    });
    await db.auditLog.create({
      data: {
        tenantId,
        userId: actor.id,
        action: `handover.${action}`,
        objectType: 'HandoverCase',
        objectId: id,
        ip: request.ip,
        after: {
          status: state.status,
          substituteId: state.substituteId ?? null,
          substituteReason: state.substituteReason ?? null,
        },
      },
    });
    return { status: state.status };
  }
}
