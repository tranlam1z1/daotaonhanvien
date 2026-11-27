import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { SessionIdentity } from '../auth/permissions';
import { object, reviewInput } from '../knowledge/knowledge-input';
import {
  contentContext,
  KnowledgeService,
} from '../knowledge/knowledge.service';
import { readConfig } from '../organization/organization-input';
import { TenantDatabase } from '../tenant/tenant-database';
import { TrainingService } from './training.service';
import {
  canUseTraining,
  missingTraining,
  staleTraining,
  workflowFields,
  workflowState,
  type ContentPermission,
  type TrainingKind,
} from './training-workflow';

type WorkingCopy = Prisma.TrainingCourseGetPayload<{
  select: typeof workflowFields;
}>;

function releaseTarget(kind: TrainingKind, id: string) {
  return kind === 'courses' ? { courseId: id } : { programId: id };
}

@Injectable()
export class TrainingApprovalService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(TrainingService) private readonly training: TrainingService,
  ) {}

  private get db() {
    return this.database.client;
  }

  async queue(actor: SessionIdentity) {
    const scope = contentContext(actor, 'content.approve')?.departmentIds;
    const query = {
      where: {
        tenantId: actor.tenantId!,
        status: 'IN_REVIEW',
        departmentId: scope ? { in: scope } : undefined,
      },
      select: { id: true, name: true, revision: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    } as const;
    const [courses, programs] = await Promise.all([
      this.db.trainingCourse.findMany({
        ...query,
        orderBy: [...query.orderBy],
      }),
      this.db.trainingProgram.findMany({
        ...query,
        orderBy: [...query.orderBy],
      }),
    ]);
    return [
      ...courses.map((row) => ({ ...row, kind: 'courses' })),
      ...programs.map((row) => ({ ...row, kind: 'programs' })),
    ];
  }

  async preview(actor: SessionIdentity, kind: TrainingKind, id: string) {
    const reviewer = await this.knowledge.lockEditor(
      actor,
      false,
      'content.approve',
    );
    const record = await this.load(reviewer, kind, id, 'content.approve');
    if (record.status !== 'IN_REVIEW') throw missingTraining();
    const [selfApproval, content] = await Promise.all([
      this.selfApproval(record.tenantId),
      this.snapshot(record, kind),
    ]);
    const courseNames =
      'courses' in content
        ? await this.db.programCourse.findMany({
            where: { tenantId: record.tenantId, programId: id },
            orderBy: [{ position: 'asc' }, { courseId: 'asc' }],
            select: { course: { select: { name: true } } },
          })
        : [];
    return {
      id,
      kind,
      revision: record.revision,
      ...workflowState(reviewer, record, selfApproval),
      content,
      courseNames: courseNames.map(({ course }) => course.name),
    };
  }

  async authorAction(
    actor: SessionIdentity,
    kind: TrainingKind,
    id: string,
    action: 'submit' | 'withdraw' | 'publish',
    body: unknown,
    ip?: string,
  ) {
    const author = await this.knowledge.lockEditor(actor);
    const record = await this.load(author, kind, id, 'content.edit');
    const selfApproval = await this.selfApproval(record.tenantId);
    const state = workflowState(author, record, selfApproval);

    if (action === 'withdraw') {
      this.assertReview(record, reviewInput(body).token);
      if (!state.canWithdraw)
        throw new ForbiddenException('Chỉ người tạo bản nháp được rút duyệt.');
      return this.update(record, kind, { status: 'DRAFT', reviewToken: null });
    }

    if (record.status !== 'DRAFT' || object(body).revision !== record.revision)
      throw staleTraining();
    if (!state.canSubmit || (action === 'publish' && !state.canPublish))
      throw new ForbiddenException(
        'Bạn không có quyền gửi duyệt hoặc tự xuất bản phiên bản này.',
      );

    if (action === 'publish')
      return this.recordDecision(
        author,
        { ...record, authorId: author.id },
        kind,
        null,
        ip,
      );

    return this.update(record, kind, {
      status: 'IN_REVIEW',
      authorId: author.id,
      reviewToken: randomUUID(),
      rejectionReason: null,
    });
  }

  async decide(
    actor: SessionIdentity,
    kind: TrainingKind,
    id: string,
    reject: boolean,
    body: unknown,
    ip?: string,
  ) {
    const reviewer = await this.knowledge.lockEditor(
      actor,
      false,
      'content.approve',
    );
    const record = await this.load(reviewer, kind, id, 'content.approve');
    const { token, reason } = reviewInput(body, reject);
    this.assertReview(record, token);
    if (
      !reject &&
      record.authorId === reviewer.id &&
      !(await this.selfApproval(record.tenantId))
    )
      throw new ForbiddenException('Doanh nghiệp chưa bật quyền tự phê duyệt.');
    return this.recordDecision(reviewer, record, kind, reason, ip);
  }

  rejections(actor: SessionIdentity) {
    return this.db.trainingRejection.findMany({
      where: { tenantId: actor.tenantId!, userId: actor.id },
      select: { id: true, title: true, reason: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reader(actor: SessionIdentity, kind: TrainingKind, id: string) {
    const tenantId = actor.tenantId!;
    const release = await this.latest(tenantId, kind, id);
    const employee = await this.db.user.findUnique({
      where: { tenantId_id: { tenantId, id: actor.id } },
      select: { departmentId: true },
    });
    if (
      !employee ||
      (release.departmentId && release.departmentId !== employee.departmentId)
    )
      throw missingTraining();
    const { name, description } = release.content as {
      name: string;
      description: string;
    };
    return {
      id,
      versionId: release.id,
      revision: release.revision,
      name,
      description,
    };
  }

  async versionForAssignment(actor: SessionIdentity, courseId: string) {
    const release = await this.latest(actor.tenantId!, 'courses', courseId);
    if (!canUseTraining(actor, release, 'assignments.manage'))
      throw missingTraining();
    return { courseId, versionId: release.id, revision: release.revision };
  }

  // F07 calls this inside its tenant transaction after authorizing the enrollment.
  async assignedCourseVersion(
    tenantId: string,
    courseId: string,
    versionId: string,
  ) {
    const release = await this.db.trainingRelease.findFirst({
      where: { tenantId, courseId, id: versionId },
      select: { id: true, revision: true, content: true },
    });
    if (!release) throw missingTraining();
    return {
      ...release,
      content: release.content as unknown as Awaited<
        ReturnType<TrainingService['courseSnapshot']>
      >,
    };
  }

  private async latest(tenantId: string, kind: TrainingKind, id: string) {
    const release = await this.db.trainingRelease.findFirst({
      where: { tenantId, ...releaseTarget(kind, id) },
      orderBy: { revision: 'desc' },
    });
    if (!release) throw missingTraining();
    return release;
  }

  private async load(
    actor: SessionIdentity,
    kind: TrainingKind,
    id: string,
    permission: ContentPermission,
  ) {
    const query = {
      where: { tenantId_id: { tenantId: actor.tenantId!, id } },
      select: workflowFields,
    };
    const record =
      kind === 'courses'
        ? await this.db.trainingCourse.findUnique(query)
        : await this.db.trainingProgram.findUnique(query);
    if (!record || !canUseTraining(actor, record, permission))
      throw missingTraining();
    return record;
  }

  private update(
    record: WorkingCopy,
    kind: TrainingKind,
    data: Pick<
      Prisma.TrainingCourseUpdateInput,
      'authorId' | 'status' | 'reviewToken' | 'rejectionReason'
    >,
  ) {
    const query = {
      where: { tenantId_id: { tenantId: record.tenantId, id: record.id } },
      data,
      select: {
        id: true,
        revision: true,
        status: true,
        reviewToken: true,
        rejectionReason: true,
      },
    };
    return kind === 'courses'
      ? this.db.trainingCourse.update(query)
      : this.db.trainingProgram.update(query);
  }

  private assertReview(record: WorkingCopy, token: string) {
    if (record.status !== 'IN_REVIEW' || record.reviewToken !== token)
      throw staleTraining();
  }

  private async selfApproval(tenantId: string) {
    const { config } = await this.db.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { config: true },
    });
    return readConfig(config).selfApproval;
  }

  private async snapshot(record: WorkingCopy, kind: TrainingKind) {
    if (kind === 'courses')
      return this.training.courseSnapshot(record.tenantId, record.id);
    return this.db.trainingProgram.findUniqueOrThrow({
      where: { tenantId_id: { tenantId: record.tenantId, id: record.id } },
      select: {
        name: true,
        description: true,
        audience: true,
        type: true,
        targetDuration: true,
        targetUnit: true,
        templateSource: true,
        courses: {
          orderBy: [{ position: 'asc' }, { courseId: 'asc' }],
          select: { courseId: true },
        },
      },
    });
  }

  private async recordDecision(
    actor: SessionIdentity,
    record: WorkingCopy,
    kind: TrainingKind,
    reason: string | null,
    ip?: string,
  ) {
    const { tenantId } = record;
    const updated = await this.update(record, kind, {
      status: reason ? 'DRAFT' : 'PUBLISHED',
      authorId: record.authorId,
      reviewToken: null,
      rejectionReason: reason,
    });
    if (reason) {
      await this.db.trainingRejection.create({
        data: {
          tenantId,
          userId: record.authorId!,
          title: record.name,
          reason,
        },
      });
    } else {
      await this.db.trainingRelease.create({
        data: {
          tenantId,
          ...releaseTarget(kind, record.id),
          departmentId: record.departmentId,
          revision: record.revision,
          content: await this.snapshot(record, kind),
        },
      });
    }
    await this.db.auditLog.create({
      data: {
        tenantId,
        userId: actor.id,
        action: reason ? 'training.reject' : 'training.approve',
        objectType: kind === 'courses' ? 'TrainingCourse' : 'TrainingProgram',
        objectId: record.id,
        before: { status: record.status, revision: record.revision },
        after: {
          status: updated.status,
          revision: updated.revision,
          reason,
          selfApproved: !reason && actor.id === record.authorId,
        },
        ip,
      },
    });
    return updated;
  }
}
