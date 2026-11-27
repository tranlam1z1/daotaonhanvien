import { Controller, Get, Module } from '@nestjs/common';
import type { HealthResponse } from '@educore36/shared';
import { AuthModule } from './auth/auth.module';
import { EmployeeController } from './employees/employee.controller';
import { EmployeeService } from './employees/employee.service';
import { EmployeeQuotaMailer } from './employees/employee-quota';
import { FilesModule } from './files/files.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { LeadsController } from './leads/leads.controller';
import { LeadInfrastructure } from './leads/leads.infrastructure';
import { OrganizationController } from './organization/organization.controller';
import { OrganizationService } from './organization/organization.service';
import { PlatformController } from './platform/platform.controller';
import { PlatformService } from './platform/platform.service';
import { TenantModule } from './tenant/tenant.module';
import { TrainingModule } from './training/training.module';
@Controller()
export class HealthController {
  @Get('health')
  health(): HealthResponse {
    return { status: 'ok' };
  }
}
@Module({
  imports: [TenantModule, AuthModule, FilesModule, KnowledgeModule, TrainingModule],
  controllers: [
    HealthController,
    LeadsController,
    PlatformController,
    OrganizationController,
    EmployeeController,
  ],
  providers: [
    LeadInfrastructure,
    PlatformService,
    OrganizationService,
    EmployeeService,
    EmployeeQuotaMailer,
  ],
})
export class AppModule {}
