import { Controller, Get, Module } from '@nestjs/common';
import type { HealthResponse } from '@educore36/shared';
@Controller()
export class HealthController {
  @Get('health')
  health(): HealthResponse {
    return { status: 'ok' };
  }
}
@Module({ controllers: [HealthController] })
export class AppModule {}
