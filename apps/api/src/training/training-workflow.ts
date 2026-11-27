import { ConflictException, NotFoundException } from '@nestjs/common';
import type { TrainingCourseStatus } from '@prisma/client';
import { can, type SessionIdentity } from '../auth/permissions';

export type TrainingKind = 'courses' | 'programs';
export type ContentPermission = 'content.edit' | 'content.approve';
type ScopedContent = { tenantId: string; departmentId: string | null };

export const workflowFields = {
  id: true,
  tenantId: true,
  departmentId: true,
  name: true,
  status: true,
  authorId: true,
  revision: true,
  reviewToken: true,
  rejectionReason: true,
} as const;

type WorkingCopy = ScopedContent & {
  status: TrainingCourseStatus;
  authorId: string | null;
  reviewToken: string | null;
  rejectionReason: string | null;
};

export function canUseTraining(
  actor: SessionIdentity,
  resource: ScopedContent,
  permission: ContentPermission | 'assignments.manage' = 'content.edit',
) {
  return can(actor, permission, {
    tenantId: resource.tenantId,
    departmentIds: [resource.departmentId],
  });
}

export function missingTraining() {
  return new NotFoundException('Không tìm thấy nội dung đào tạo.');
}

export function staleTraining() {
  return new ConflictException(
    'Nội dung đã thay đổi. Hãy mở lại bản lưu mới nhất.',
  );
}

export function draftChanges(
  status: TrainingCourseStatus,
  authorId: string | null,
  editorId: string,
) {
  if (status === 'IN_REVIEW')
    throw new ConflictException(
      'Nội dung đang chờ duyệt. Hãy rút lại để chỉnh sửa.',
    );
  return {
    status: 'DRAFT' as const,
    authorId: status === 'PUBLISHED' ? editorId : (authorId ?? editorId),
    revision: { increment: 1 },
  };
}

export function workflowState(
  actor: SessionIdentity,
  record: WorkingCopy,
  selfApproval: boolean,
) {
  const own = record.authorId === actor.id;
  const draft = record.status === 'DRAFT';
  const canApprove = canUseTraining(actor, record, 'content.approve');
  return {
    status: record.status,
    reviewToken: record.reviewToken,
    rejectionReason: record.rejectionReason,
    canSubmit: draft && (own || record.authorId === null),
    canWithdraw: record.status === 'IN_REVIEW' && own,
    canPublish:
      draft && (own || record.authorId === null) && selfApproval && canApprove,
    canApprove:
      record.status === 'IN_REVIEW' && canApprove && (!own || selfApproval),
  };
}
