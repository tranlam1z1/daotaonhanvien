import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { can, type SessionIdentity } from '../auth/permissions';
import { object, text } from '../knowledge/knowledge-input';
import { TenantDatabase } from '../tenant/tenant-database';
import { TrainingApprovalService } from '../training/training-approval.service';
import {
  CompletionService,
  courseCriteria,
  isActive,
  type AssignedContent,
} from './completion.service';
import { activeEnrollmentStatuses } from './learning-policy';

@Injectable()
export class PracticeService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(TrainingApprovalService)
    private readonly training: TrainingApprovalService,
    @Inject(CompletionService) private readonly completion: CompletionService,
  ) {}

  private get db() {
    return this.database.client;
  }

  async list(actor: SessionIdentity) {
    const tenantId = actor.tenantId!;
    const rows = await this.db.enrollment.findMany({
      where: {
        tenantId,
        status: { in: [...activeEnrollmentStatuses, 'COMPLETED'] },
        user: {
          deletedAt: null,
          ...(can(actor, 'practice.confirm')
            ? {}
            : { managerId: actor.id, id: { not: actor.id } }),
        },
      },
      select: {
        id: true,
        status: true,
        user: { select: { fullName: true } },
        courseVersion: { select: { content: true } },
        practice: {
          select: { passed: true, comment: true, confirmedAt: true },
        },
      },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
    });
    return rows.flatMap(({ id, status, user, courseVersion, practice }) => {
      const content = courseVersion.content as AssignedContent;
      return courseCriteria(content).practiceRequired
        ? [
            {
              id,
              status,
              employee: user.fullName,
              course: content.name,
              practice,
            },
          ]
        : [];
    });
  }

  async confirm(actor: SessionIdentity, id: string, body: unknown) {
    const { passed, comment: rawComment } = object(body);
    if (typeof passed !== 'boolean')
      throw new BadRequestException('Chọn kết quả thực hành.');
    const comment = text(rawComment, 2000, 'Nhận xét', true);
    const tenantId = actor.tenantId!;
    const admin = can(actor, 'practice.confirm');
    const [scope] = await this.db.$queryRaw<{ id: string }[]>`
      SELECT e.id FROM enrollments e JOIN users u ON u.tenant_id = e.tenant_id AND u.id = e.user_id
      WHERE e.tenant_id = ${tenantId}::uuid AND e.id = ${id}::uuid
        AND u.deleted_at IS NULL AND (${admin} OR (u.manager_id = ${actor.id}::uuid AND u.id <> ${actor.id}::uuid))
      FOR UPDATE OF e
    `;
    if (!scope)
      throw new NotFoundException(
        'Không tìm thấy lượt thực hành trong phạm vi.',
      );
    const enrollment = await this.db.enrollment.findUniqueOrThrow({
      where: { id },
    });
    const { content } = await this.training.assignedCourseVersion(
      tenantId,
      enrollment.courseId,
      enrollment.courseVersionId,
    );
    if (!courseCriteria(content).practiceRequired)
      throw new NotFoundException('Khóa học này chưa bật xác nhận thực hành.');
    if (!isActive(enrollment.status))
      throw new ConflictException('Lượt học đã kết thúc.');
    const key = { tenantId, enrollmentId: id };
    const now = new Date();
    const data = { passed, comment, confirmedById: actor.id, confirmedAt: now };
    await this.db.practiceResult.upsert({
      where: { tenantId_enrollmentId: key },
      create: { ...key, ...data },
      update: data,
    });
    return { status: await this.completion.evaluate(enrollment, content, now) };
  }
}
