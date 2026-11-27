import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthOriginGuard, type SessionRequest } from '../auth/auth-http';
import { RequirePermission } from '../auth/authorization.guard';
import { idInput } from '../knowledge/knowledge-input';
import { contentContext } from '../knowledge/knowledge.service';
import { TrainingApprovalService } from './training-approval.service';
import { TrainingService } from './training.service';
import type { ContentPermission, TrainingKind } from './training-workflow';

const contentPermission = (permission: ContentPermission) =>
  RequirePermission(permission, async (_db, { user }) =>
    contentContext(user!, permission),
  );

function trainingKind(kind: string): TrainingKind {
  if (kind === 'courses' || kind === 'programs') return kind;
  throw new BadRequestException('Loại nội dung đào tạo không hợp lệ.');
}

@Controller('training')
export class TrainingApprovalController {
  constructor(
    @Inject(TrainingApprovalService)
    private readonly approval: TrainingApprovalService,
    @Inject(TrainingService) private readonly training: TrainingService,
  ) {}

  @Post('editor/:kind/:id/workflow/:action')
  @HttpCode(200)
  @UseGuards(AuthOriginGuard)
  @contentPermission('content.edit')
  authorAction(
    @Req() { user, ip }: SessionRequest,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: unknown,
  ) {
    if (action !== 'submit' && action !== 'withdraw' && action !== 'publish')
      throw new BadRequestException('Thao tác phiên bản không hợp lệ.');
    return this.approval.authorAction(
      user!,
      trainingKind(kind),
      idInput(id),
      action,
      body,
      ip,
    );
  }

  @Get('reviews')
  @Header('Cache-Control', 'private, no-store')
  @contentPermission('content.approve')
  queue(@Req() { user }: SessionRequest) {
    return this.approval.queue(user!);
  }

  @Get('reviews/:kind/:id')
  @Header('Cache-Control', 'private, no-store')
  @contentPermission('content.approve')
  preview(
    @Req() { user }: SessionRequest,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ) {
    return this.approval.preview(user!, trainingKind(kind), idInput(id));
  }

  @Get('reviews/courses/:id/lessons/:lessonId/file')
  @Header('Cache-Control', 'private, no-store')
  @contentPermission('content.approve')
  file(
    @Req() { user }: SessionRequest,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.training.download(
      user!,
      idInput(id),
      idInput(lessonId),
      'content.approve',
    );
  }

  @Post('reviews/:kind/:id/:action')
  @HttpCode(200)
  @UseGuards(AuthOriginGuard)
  @contentPermission('content.approve')
  decide(
    @Req() { user, ip }: SessionRequest,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: unknown,
  ) {
    if (action !== 'approve' && action !== 'reject')
      throw new BadRequestException('Quyết định phê duyệt không hợp lệ.');
    return this.approval.decide(
      user!,
      trainingKind(kind),
      idInput(id),
      action === 'reject',
      body,
      ip,
    );
  }

  @Get('rejections')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('session.profile', async (_db, { user }) =>
    user?.tenantId ? { tenantId: user.tenantId } : null,
  )
  rejections(@Req() { user }: SessionRequest) {
    return this.approval.rejections(user!);
  }

  @Get('read/:kind/:id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('learning.use')
  read(
    @Req() { user }: SessionRequest,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ) {
    return this.approval.reader(user!, trainingKind(kind), idInput(id));
  }

  @Get('assignable/courses/:id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('assignments.manage', async (_db, { user }) =>
    contentContext(user!, 'content.edit'),
  )
  assignable(@Req() { user }: SessionRequest, @Param('id') id: string) {
    return this.approval.versionForAssignment(user!, idInput(id));
  }
}
