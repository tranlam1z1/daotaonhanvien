import {
  BadRequestException,
  type CallHandler,
  Controller,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  PayloadTooLargeException,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { unlink } from 'node:fs/promises';
import { AuthOriginGuard, type SessionRequest } from '../auth/auth-http';
import { RequirePermission } from '../auth/authorization.guard';
import { UseManualTenantTransaction } from '../tenant/tenant.interceptor';
import { uploadScope } from './file-access';
import type { DiskUpload } from './file-policy';
import { FilesService } from './files.service';

const MultipartUpload = FileInterceptor('file');

@Injectable()
class FileUploadInterceptor extends MultipartUpload {
  async intercept(context: ExecutionContext, next: CallHandler) {
    try {
      return await super.intercept(context, next);
    } catch (error) {
      if (error instanceof PayloadTooLargeException)
        throw new PayloadTooLargeException(
          'Tệp vượt giới hạn dung lượng tải lên.',
        );
      if (error instanceof BadRequestException)
        throw new BadRequestException(
          'Yêu cầu tải lên phải chứa đúng một tệp.',
        );
      throw error;
    }
  }
}

@Controller('files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name);
  constructor(@Inject(FilesService) private readonly files: FilesService) {}

  @Post()
  @UseGuards(AuthOriginGuard)
  @RequirePermission('content.edit', (db, request) => {
    const tenantId = request.user?.tenantId;
    return tenantId
      ? uploadScope(db, tenantId, request.query.departmentId)
      : Promise.resolve(null);
  })
  @UseManualTenantTransaction()
  @UseInterceptors(FileUploadInterceptor)
  async upload(
    @Req() request: SessionRequest,
    @UploadedFile() file?: DiskUpload,
  ) {
    if (!file)
      throw new BadRequestException('Vui lòng chọn một tệp để tải lên.');
    try {
      return await this.files.upload(
        request.user!,
        file,
        request.query.departmentId,
      );
    } finally {
      await unlink(file.path).catch(() =>
        this.logger.warn('Could not remove temporary upload'),
      );
    }
  }
}
