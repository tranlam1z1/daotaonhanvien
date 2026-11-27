import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthOriginGuard, type SessionRequest } from '../auth/auth-http';
import { RequirePermission } from '../auth/authorization.guard';
import { idInput } from '../knowledge/knowledge-input';
import { TenantDatabase } from '../tenant/tenant-database';
import { UseManualTenantTransaction } from '../tenant/tenant.interceptor';
import { assessmentContext, AssessmentsService } from './assessments.service';
import {
  questionTemplate,
  questionUploadLimit,
  readQuestionWorkbook,
} from './question-workbook';

const manage = () =>
  RequirePermission('assessments.manage', async (_db, { user }) =>
    assessmentContext(user!),
  );

@Controller('assessments')
export class AssessmentsController {
  constructor(
    @Inject(AssessmentsService)
    private readonly assessments: AssessmentsService,
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  @Get()
  @manage()
  catalog(@Req() { user }: SessionRequest) {
    return this.assessments.catalog(user!);
  }

  @Get('questions/template')
  @manage()
  @UseManualTenantTransaction()
  async template() {
    return new StreamableFile(await questionTemplate(), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="mau-nhap-cau-hoi.xlsx"',
    });
  }

  @Post('questions/import')
  @UseGuards(AuthOriginGuard)
  @manage()
  @UseManualTenantTransaction()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: questionUploadLimit, files: 1, fields: 0 },
    }),
  )
  async import(
    @Req() { user }: SessionRequest,
    @Query() group: Record<string, unknown>,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    const rows = await readQuestionWorkbook(file?.buffer);
    return this.database.run(user!.tenantId, () =>
      this.assessments.importQuestions(user!, group, rows),
    );
  }

  @Post('questions')
  @UseGuards(AuthOriginGuard)
  @manage()
  createQuestion(@Req() { user }: SessionRequest, @Body() body: unknown) {
    return this.assessments.saveQuestion(user!, body);
  }

  @Patch('questions/:id')
  @UseGuards(AuthOriginGuard)
  @manage()
  updateQuestion(
    @Req() { user }: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.assessments.saveQuestion(user!, body, idInput(id));
  }

  @Delete('questions/:id')
  @UseGuards(AuthOriginGuard)
  @manage()
  @HttpCode(204)
  removeQuestion(@Req() { user }: SessionRequest, @Param('id') id: string) {
    return this.assessments.removeQuestion(user!, idInput(id));
  }

  @Post('quizzes')
  @UseGuards(AuthOriginGuard)
  @manage()
  createQuiz(@Req() { user }: SessionRequest, @Body() body: unknown) {
    return this.assessments.saveQuiz(user!, body);
  }

  @Patch('quizzes/:id')
  @UseGuards(AuthOriginGuard)
  @manage()
  updateQuiz(
    @Req() { user }: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.assessments.saveQuiz(user!, body, idInput(id));
  }
}
