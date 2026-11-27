import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { TrainingModule } from '../training/training.module';
import { AttemptService } from './attempt.service';
import { CompletionService } from './completion.service';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { PracticeService } from './practice.service';
import { SurveyService } from './survey.service';

@Module({
  imports: [AuthModule, FilesModule, KnowledgeModule, TrainingModule],
  controllers: [LearningController],
  providers: [
    LearningService,
    AttemptService,
    CompletionService,
    PracticeService,
    SurveyService,
  ],
})
export class LearningModule {}
