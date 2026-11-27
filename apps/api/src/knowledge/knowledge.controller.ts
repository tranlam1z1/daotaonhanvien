import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthOriginGuard, type SessionRequest } from '../auth/auth-http';
import { RequirePermission } from '../auth/authorization.guard';
import { idInput, readerFilters } from './knowledge-input';
import { contentContext, KnowledgeService } from './knowledge.service';

function catalogKind(value: string) {
  if (value === 'categories') return 'category';
  if (value === 'tags') return 'tag';
  throw new BadRequestException('Loại danh mục không hợp lệ.');
}

const contentPermission = (permission: 'content.edit' | 'content.approve') =>
  RequirePermission(permission, async (_db, request) =>
    contentContext(request.user!, permission),
  );
const editorPermission = () => contentPermission('content.edit');
const reviewerPermission = () => contentPermission('content.approve');

const readerPermission = () =>
  RequirePermission('knowledge.read', async (_db, { user }) =>
    user?.tenantId ? { tenantId: user.tenantId, knowledgeVisible: true } : null,
  );

@Controller('knowledge')
export class KnowledgeController {
  constructor(
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
  ) {}

  @Get('reviews')
  @reviewerPermission()
  reviews(@Req() request: SessionRequest) {
    return this.knowledge.reviewQueue(request.user!);
  }

  @Get('reviews/:id')
  @reviewerPermission()
  review(@Req() request: SessionRequest, @Param('id') id: string) {
    return this.knowledge.previewVersion(
      request.user!,
      idInput(id),
      'content.approve',
    );
  }

  @Get('reviews/:id/files/:fileId')
  @reviewerPermission()
  reviewFile(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    return this.knowledge.downloadReview(
      request.user!,
      idInput(id),
      idInput(fileId),
      'content.approve',
    );
  }

  @Post('reviews/:id/:action')
  @HttpCode(200)
  @UseGuards(AuthOriginGuard)
  @reviewerPermission()
  decide(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: unknown,
  ) {
    if (action !== 'approve' && action !== 'reject')
      throw new BadRequestException('Quyết định phê duyệt không hợp lệ.');
    return this.knowledge.decide(
      request.user!,
      idInput(id),
      action === 'reject',
      body,
      request.ip,
    );
  }

  @Get('rejections')
  @RequirePermission('session.profile', async (_db, { user }) =>
    user?.tenantId ? { tenantId: user.tenantId } : null,
  )
  rejections(@Req() request: SessionRequest) {
    return this.knowledge.rejections(request.user!);
  }

  @Get('editor/submissions/:id')
  @editorPermission()
  submission(@Req() request: SessionRequest, @Param('id') id: string) {
    return this.knowledge.previewVersion(
      request.user!,
      idInput(id),
      'content.edit',
    );
  }

  @Get('editor/submissions/:id/files/:fileId')
  @editorPermission()
  submissionFile(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    return this.knowledge.downloadReview(
      request.user!,
      idInput(id),
      idInput(fileId),
      'content.edit',
    );
  }

  @Post('editor/versions/:id/:action')
  @HttpCode(200)
  @UseGuards(AuthOriginGuard)
  @editorPermission()
  authorAction(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: unknown,
  ) {
    if (action !== 'submit' && action !== 'withdraw' && action !== 'publish')
      throw new BadRequestException('Thao tác phiên bản không hợp lệ.');
    return this.knowledge.authorAction(
      request.user!,
      idInput(id),
      action,
      body,
      request.ip,
    );
  }

  @Post('editor/publications/:id/history/:versionId/draft')
  @UseGuards(AuthOriginGuard)
  @editorPermission()
  startRevision(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.knowledge.startRevision(
      request.user!,
      idInput(id),
      idInput(versionId),
    );
  }

  @Get('editor')
  @editorPermission()
  editor(@Req() request: SessionRequest) {
    return this.knowledge.editor(request.user!);
  }

  @Get('editor/drafts/:id')
  @editorPermission()
  draft(@Req() request: SessionRequest, @Param('id') id: string) {
    return this.knowledge.draft(request.user!, idInput(id));
  }

  @Post('editor/drafts')
  @UseGuards(AuthOriginGuard)
  @editorPermission()
  createDraft(@Req() request: SessionRequest, @Body() input: unknown) {
    return this.knowledge.saveDraft(request.user!, input);
  }

  @Patch('editor/drafts/:id')
  @UseGuards(AuthOriginGuard)
  @editorPermission()
  updateDraft(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.knowledge.saveDraft(request.user!, input, idInput(id));
  }

  @Get('editor/drafts/:id/files/:fileId')
  @editorPermission()
  download(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    return this.knowledge.downloadDraft(
      request.user!,
      idInput(id),
      idInput(fileId),
    );
  }

  @Post('editor/catalog/:kind')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('content.edit')
  createCatalog(
    @Req() request: SessionRequest,
    @Param('kind') kind: string,
    @Body() body: unknown,
  ) {
    return this.knowledge.saveTaxonomy(request.user!, catalogKind(kind), body);
  }

  @Patch('editor/catalog/:kind/:id')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('content.edit')
  updateCatalog(
    @Req() request: SessionRequest,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.knowledge.saveTaxonomy(
      request.user!,
      catalogKind(kind),
      body,
      idInput(id),
    );
  }

  @Delete('editor/catalog/:kind/:id')
  @UseGuards(AuthOriginGuard)
  @RequirePermission('content.edit')
  deleteCatalog(
    @Req() request: SessionRequest,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ) {
    return this.knowledge.deleteTaxonomy(
      request.user!,
      catalogKind(kind),
      idInput(id),
    );
  }

  @Get('editor/publications')
  @Header('Cache-Control', 'private, no-store')
  @editorPermission()
  publications(@Req() request: SessionRequest) {
    return this.knowledge.publications(request.user!);
  }

  @Get('editor/publications/:id/history')
  @Header('Cache-Control', 'private, no-store')
  @editorPermission()
  history(@Req() request: SessionRequest, @Param('id') id: string) {
    return this.knowledge.publicationHistory(request.user!, idInput(id));
  }

  @Get('editor/publications/:id/history/:versionId')
  @Header('Cache-Control', 'private, no-store')
  @editorPermission()
  historicalVersion(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.knowledge.historicalVersion(
      request.user!,
      idInput(id),
      idInput(versionId),
    );
  }

  @Get('editor/publications/:id/history/:versionId/files/:fileId')
  @Header('Cache-Control', 'private, no-store')
  @editorPermission()
  historicalFile(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.knowledge.downloadHistorical(
      request.user!,
      idInput(id),
      idInput(versionId),
      idInput(fileId),
    );
  }

  @Patch('editor/publications/:id/archive')
  @UseGuards(AuthOriginGuard)
  @editorPermission()
  archive(@Req() request: SessionRequest, @Param('id') id: string) {
    return this.knowledge.changePublication(request.user!, idInput(id), true);
  }

  @Patch('editor/publications/:id/restore')
  @UseGuards(AuthOriginGuard)
  @editorPermission()
  restore(@Req() request: SessionRequest, @Param('id') id: string) {
    return this.knowledge.changePublication(request.user!, idInput(id), false);
  }

  @Get('read')
  @Header('Cache-Control', 'private, no-store')
  @readerPermission()
  readers(
    @Req() request: SessionRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.knowledge.readers(request.user!, readerFilters(query));
  }

  @Get('read/:id')
  @Header('Cache-Control', 'private, no-store')
  @readerPermission()
  read(@Req() request: SessionRequest, @Param('id') id: string) {
    return this.knowledge.reader(request.user!, idInput(id));
  }

  @Get('read/:id/files/:fileId')
  @Header('Cache-Control', 'private, no-store')
  @readerPermission()
  publishedFile(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    return this.knowledge.downloadPublished(
      request.user!,
      idInput(id),
      idInput(fileId),
    );
  }
}
