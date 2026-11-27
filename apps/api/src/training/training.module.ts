import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { TemplateReleasesService } from './templates/template-releases.service';
import { TemplateUpdatesService } from './templates/template-updates.service';
import { TrainingTemplateController } from './templates/template.controller';
import { TrainingApprovalController } from './training-approval.controller';
import { TrainingApprovalService } from './training-approval.service';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';

@Module({
  imports: [AuthModule, FilesModule, KnowledgeModule],
  controllers: [
    TrainingController,
    TrainingTemplateController,
    TrainingApprovalController,
  ],
  providers: [
    TrainingService,
    TrainingApprovalService,
    TemplateReleasesService,
    TemplateUpdatesService,
  ],
  exports: [TrainingApprovalService],
})
export class TrainingModule {}
