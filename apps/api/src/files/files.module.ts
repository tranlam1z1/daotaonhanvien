import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { tmpdir } from 'node:os';
import { AuthModule } from '../auth/auth.module';
import { filePolicy } from './file-policy';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { ObjectStorage } from './object-storage';

@Module({
  imports: [
    AuthModule,
    MulterModule.registerAsync({
      useFactory: () => {
        const { documentBytes, videoBytes } = filePolicy();
        return {
          dest: tmpdir(),
          // The disk upload cap is inclusive. Format-specific limits follow validation.
          limits: {
            files: 1,
            fields: 0,
            fileSize: Math.max(documentBytes, videoBytes) + 1,
          },
        };
      },
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService, ObjectStorage],
  exports: [FilesService],
})
export class FilesModule {}
