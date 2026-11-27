import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
import { AttemptService } from './attempt.service';
import { LearningService } from './learning.service';
import { PracticeService } from './practice.service';
import { SurveyService } from './survey.service';

const practicePermission = () =>
  RequirePermission('practice.confirm', async (_db, { user }) => ({
    tenantId: user!.tenantId!,
    employee: { id: '', managerId: user!.id },
  }));

@Controller('learning')
export class LearningController {
  constructor(
    @Inject(LearningService) private readonly learning: LearningService,
    @Inject(AttemptService) private readonly attempts: AttemptService,
    @Inject(PracticeService) private readonly practice: PracticeService,
    @Inject(SurveyService) private readonly survey: SurveyService,
  ) {}

  @Get()
  @RequirePermission('learning.use')
  list(@Req() { user }: SessionRequest) {
    return this.learning.list(user!);
  }

  @Get(':id')
  @RequirePermission('learning.use')
  detail(@Req() { user }: SessionRequest, @Param('id') id: string) {
    return this.learning.detail(user!, idInput(id));
  }

  @Post(':id/lessons/:lessonId/open')
  @HttpCode(200)
  @UseGuards(AuthOriginGuard)
  @RequirePermission('learning.use')
  open(
    @Req() { user }: SessionRequest,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.learning.open(user!, idInput(id), idInput(lessonId));
  }

  @Get(':id/lessons/:lessonId/file')
  @RequirePermission('learning.use')
  file(
    @Req() { user }: SessionRequest,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.learning.file(user!, idInput(id), idInput(lessonId));
  }

  @Post(':id/lessons/:lessonId/complete')
  @HttpCode(200)
  @UseGuards(AuthOriginGuard)
  @RequirePermission('learning.use')
  complete(
    @Req() { user }: SessionRequest,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.learning.complete(user!, idInput(id), idInput(lessonId));
  }

  @Post(':id/lessons/:lessonId/video')
  @HttpCode(200)
  @UseGuards(AuthOriginGuard)
  @RequirePermission('learning.use')
  video(
    @Req() { user }: SessionRequest,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Body() body: unknown,
  ) {
    return this.learning.video(user!, idInput(id), idInput(lessonId), body);
  }

  @Post(':id/lessons/:lessonId/quiz/:action')
  @HttpCode(200)
  @UseGuards(AuthOriginGuard)
  @RequirePermission('learning.use')
  quiz(
    @Req() { user }: SessionRequest,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Param('action') action: string,
    @Body() body: unknown,
  ) {
    if (
      action !== 'load' &&
      action !== 'start' &&
      action !== 'save' &&
      action !== 'submit' &&
      action !== 'review'
    )
      throw new BadRequestException('Thao tác bài kiểm tra không hợp lệ.');
    return this.attempts.act(
      user!,
      idInput(id),
      idInput(lessonId),
      action,
      body,
    );
  }

  @Get('practice/list')
  @practicePermission()
  practiceList(@Req() { user }: SessionRequest) {
    return this.practice.list(user!);
  }

  @Post('practice/:id/confirm')
  @HttpCode(200)
  @UseGuards(AuthOriginGuard)
  @practicePermission()
  confirm(
    @Req() { user }: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.practice.confirm(user!, idInput(id), body);
  }

  @Get('survey/template')
  @RequirePermission('assessments.manage')
  surveyTemplate(@Req() { user }: SessionRequest) {
    return this.survey.template(user!);
  }

  @Post('survey/template')
  @HttpCode(200)
  @UseGuards(AuthOriginGuard)
  @RequirePermission('assessments.manage')
  saveSurveyTemplate(@Req() { user }: SessionRequest, @Body() body: unknown) {
    return this.survey.saveTemplate(user!, body);
  }

  @Get(':id/survey')
  @RequirePermission('learning.use')
  surveyView(@Req() { user }: SessionRequest, @Param('id') id: string) {
    return this.survey.view(user!, idInput(id));
  }

  @Post(':id/survey')
  @HttpCode(200)
  @UseGuards(AuthOriginGuard)
  @RequirePermission('learning.use')
  surveySubmit(
    @Req() { user }: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.survey.submit(user!, idInput(id), body);
  }
}
