import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssignmentRulesService } from './assignment-rules.service';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';

@Module({
  imports: [AuthModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService, AssignmentRulesService],
  exports: [AssignmentRulesService],
})
export class AssignmentsModule {}
