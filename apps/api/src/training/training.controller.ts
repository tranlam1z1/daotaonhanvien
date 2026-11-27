import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthOriginGuard, type SessionRequest } from '../auth/auth-http';
import { RequirePermission } from '../auth/authorization.guard';
import { idInput, object } from '../knowledge/knowledge-input';
import { contentContext } from '../knowledge/knowledge.service';
import { TrainingService } from './training.service';

const editor = () =>
  RequirePermission('content.edit', async (_db, request) =>
    contentContext(request.user!, 'content.edit'),
  );

@Controller('training/editor')
export class TrainingController {
  constructor(
    @Inject(TrainingService) private readonly training: TrainingService,
  ) {}

  @Get()
  @editor()
  catalog(@Req() { user }: SessionRequest) {
    return this.training.editor(user!);
  }

  @Post('programs')
  @UseGuards(AuthOriginGuard)
  @editor()
  createProgram(@Req() { user }: SessionRequest, @Body() body: unknown) {
    return this.training.saveProgram(user!, body);
  }

  @Patch('programs/:id')
  @UseGuards(AuthOriginGuard)
  @editor()
  updateProgram(
    @Req() { user }: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.training.saveProgram(user!, body, idInput(id));
  }

  @Get('courses/:id')
  @editor()
  course(@Req() { user }: SessionRequest, @Param('id') id: string) {
    return this.training.course(user!, idInput(id));
  }

  @Post('courses')
  @UseGuards(AuthOriginGuard)
  @editor()
  createCourse(@Req() { user }: SessionRequest, @Body() body: unknown) {
    return this.training.saveCourse(user!, body);
  }

  @Patch('courses/:id')
  @UseGuards(AuthOriginGuard)
  @editor()
  updateCourse(
    @Req() { user }: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.training.saveCourse(user!, body, idInput(id));
  }

  @Post('courses/:id/copy')
  @UseGuards(AuthOriginGuard)
  @editor()
  copyCourse(
    @Req() { user }: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.training.copyCourse(user!, idInput(id), object(body).name);
  }

  @Get('courses/:id/lessons/:lessonId/file')
  @editor()
  download(
    @Req() { user }: SessionRequest,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.training.download(user!, idInput(id), idInput(lessonId));
  }
}
