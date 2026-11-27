import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthOriginGuard, type SessionRequest } from '../../auth/auth-http';
import { RequirePermission } from '../../auth/authorization.guard';
import { idInput, object } from '../../knowledge/knowledge-input';
import { editorContext } from '../../knowledge/knowledge.service';
import { UseManualTenantTransaction } from '../../tenant/tenant.interceptor';
import { TenantDatabase } from '../../tenant/tenant-database';
import { TrainingService } from '../training.service';
import { TemplateUpdatesService } from './template-updates.service';
import { TemplateReleasesService } from './template-releases.service';
import { selectTemplate, type TemplateLevel } from './template-selection';

function templateLevel(level: string): TemplateLevel {
  if (
    level === 'program' ||
    level === 'course' ||
    level === 'module' ||
    level === 'lesson'
  ) {
    return level;
  }
  throw new BadRequestException('Cấp nội dung mẫu không hợp lệ.');
}

function destination(body: unknown) {
  const { departmentId } = object(body);
  return departmentId == null ? null : idInput(departmentId);
}

@Controller('training/templates')
export class TrainingTemplateController {
  constructor(
    @Inject(TrainingService) private readonly training: TrainingService,
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(TemplateReleasesService)
    private readonly releases: TemplateReleasesService,
    @Inject(TemplateUpdatesService)
    private readonly updates: TemplateUpdatesService,
  ) {}

  @Get()
  @RequirePermission('templates.apply', async (_db, { user }) =>
    editorContext(user!),
  )
  async catalog() {
    return (await this.releases.latest())[0];
  }

  @Get('releases')
  @RequirePermission('templates.apply', async (_db, { user }) =>
    editorContext(user!),
  )
  listReleases() {
    return this.releases.latest();
  }

  @Get('platform/releases')
  @UseManualTenantTransaction()
  @RequirePermission('platform.manage')
  platformCatalog() {
    return this.database.runPlatform(null, () => this.releases.latest());
  }

  @Post('releases')
  @UseManualTenantTransaction()
  @UseGuards(AuthOriginGuard)
  @RequirePermission('platform.manage')
  publish(@Body() body: unknown, @Req() request: SessionRequest) {
    return this.releases.publish(body, request.user!.id, request.ip);
  }

  @Get('updates/:courseId')
  @RequirePermission('templates.apply', async (_db, { user }) =>
    editorContext(user!),
  )
  listUpdates(
    @Req() { user }: SessionRequest,
    @Param('courseId') courseId: string,
  ) {
    return this.updates.list(user!, idInput(courseId));
  }

  @Post('updates/:courseId')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('templates.apply', async (_db, { user }) =>
    editorContext(user!),
  )
  applyUpdate(
    @Req() { user }: SessionRequest,
    @Param('courseId') courseId: string,
    @Body() body: unknown,
  ) {
    return this.updates.apply(user!, idInput(courseId), body);
  }

  @Post(':level/:id/copy')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('templates.apply', async (_db, request) => {
    return request.user?.tenantId
      ? {
          tenantId: request.user.tenantId,
          departmentIds: [destination(request.body)],
        }
      : null;
  })
  async copy(
    @Req() { user }: SessionRequest,
    @Param('level') level: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const programId = object(body).programId;
    const selections = (await this.releases.latest())
      .filter(({ program }) => programId == null || program.id === programId)
      .map((release) => selectTemplate(templateLevel(level), id, release));
    const selection = selections.find((item) => item !== null);
    if (!selection)
      throw new NotFoundException('Không tìm thấy mục mẫu đã phát hành.');

    const author = user!;
    const tenantId = author.tenantId!;
    const departmentId = destination(body);
    const db = this.database.client;
    const courseIds: string[] = [];

    for (const source of selection.courses) {
      const course = await this.training.saveCourse(author, {
        ...source,
        departmentId,
      });
      courseIds.push(course.id);
      if (source.templateSource) {
        await db.trainingCourse.update({
          where: { tenantId_id: { tenantId, id: course.id } },
          data: { templateSource: source.templateSource },
        });
      }

      for (const [position, moduleSource] of source.modules.entries()) {
        const module = course.modules[position];
        if (moduleSource.templateSource) {
          await db.trainingModule.update({
            where: { tenantId_id: { tenantId, id: module.id } },
            data: { templateSource: moduleSource.templateSource },
          });
        }

        for (const [
          lessonPosition,
          lessonSource,
        ] of moduleSource.lessons.entries()) {
          await db.trainingLesson.update({
            where: {
              tenantId_id: { tenantId, id: module.lessons[lessonPosition].id },
            },
            data: { templateSource: lessonSource.templateSource },
          });
        }
      }
    }

    const program = selection.program;
    if (!program) return { programId: null, courseIds };

    const draft = await this.training.saveProgram(author, {
      ...program,
      departmentId,
      courseIds,
    });
    await db.trainingProgram.update({
      where: { tenantId_id: { tenantId, id: draft.id } },
      data: { templateSource: program.templateSource },
    });
    return { programId: draft.id, courseIds };
  }
}
