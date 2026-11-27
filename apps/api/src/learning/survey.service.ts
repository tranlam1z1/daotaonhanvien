import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { SessionIdentity } from '../auth/permissions';
import { object, text } from '../knowledge/knowledge-input';
import { TenantDatabase } from '../tenant/tenant-database';

const defaults = {
  content: 'Nội dung khóa học',
  usefulness: 'Mức độ áp dụng',
  length: 'Độ dài khóa học',
  feedback: 'Góp ý thêm',
};
const ratingKeys = ['content', 'usefulness', 'length'] as const;

function jsonObject(value: Prisma.JsonValue | undefined): Prisma.JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

@Injectable()
export class SurveyService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  private get db() {
    return this.database.client;
  }

  private async config(tenantId: string) {
    return (
      await this.db.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { config: true },
      })
    ).config;
  }

  async template(actor: SessionIdentity) {
    const config = await this.config(actor.tenantId!);
    const configured = jsonObject(jsonObject(config).courseSurvey);
    return {
      content:
        typeof configured.content === 'string'
          ? configured.content
          : defaults.content,
      usefulness:
        typeof configured.usefulness === 'string'
          ? configured.usefulness
          : defaults.usefulness,
      length:
        typeof configured.length === 'string'
          ? configured.length
          : defaults.length,
      feedback:
        typeof configured.feedback === 'string'
          ? configured.feedback
          : defaults.feedback,
    };
  }

  async saveTemplate(actor: SessionIdentity, input: unknown) {
    const tenantId = actor.tenantId!;
    const body = object(input);
    const survey = {
      content: text(body.content, 200, 'Nội dung', true),
      usefulness: text(body.usefulness, 200, 'Mức độ áp dụng', true),
      length: text(body.length, 200, 'Độ dài', true),
      feedback: text(body.feedback, 200, 'Góp ý', true),
    };
    await this.db
      .$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
    const config = jsonObject(await this.config(tenantId));
    await this.db.tenant.update({
      where: { id: tenantId },
      data: {
        config: { ...config, courseSurvey: survey },
        updatedBy: actor.id,
      },
    });
    return survey;
  }

  private async completed(actor: SessionIdentity, id: string) {
    const tenantId = actor.tenantId!;
    const row = await this.db.enrollment.findFirst({
      where: { tenantId, id, userId: actor.id },
      select: { status: true },
    });
    if (!row) throw new NotFoundException('Không tìm thấy lượt học.');
    if (row.status !== 'COMPLETED')
      throw new ConflictException(
        'Bạn có thể khảo sát sau khi hoàn thành khóa học.',
      );
    return { tenantId, enrollmentId: id };
  }

  async view(actor: SessionIdentity, id: string) {
    const key = await this.completed(actor, id);
    const found = await this.db.courseSurveyResponse.findUnique({
      where: { tenantId_enrollmentId: key },
      select: { submittedAt: true },
    });
    return { template: await this.template(actor), submitted: !!found };
  }

  async submit(actor: SessionIdentity, id: string, input: unknown) {
    const key = await this.completed(actor, id);
    const body = object(input);
    const values = object(body.ratings);
    const template = await this.template(actor);
    const ratings = ratingKeys.map((name) => {
      const value = values[name];
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 1 ||
        value > 5
      )
        throw new BadRequestException(
          'Chọn mức từ 1 đến 5 cho cả ba tiêu chí.',
        );
      return { name, label: template[name], value };
    });
    const feedback = text(body.feedback, 3000, 'Góp ý');
    await this.db.courseSurveyResponse.createMany({
      data: [{ ...key, ratings, feedback }],
      skipDuplicates: true,
    });
    return { submitted: true };
  }
}
