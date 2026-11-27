import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { AuthController } from './auth.controller';
import { AuthOriginGuard, SessionGuard } from './auth-http';
import { AuthMailer } from './auth-mailer';
import { AuthService } from './auth.service';
import { AuthorizationGuard } from './authorization.guard';
import { MeController } from './me.controller';

@Module({
  imports: [TenantModule],
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    AuthMailer,
    AuthOriginGuard,
    SessionGuard,
    AuthorizationGuard,
  ],
  exports: [AuthService, AuthOriginGuard, SessionGuard, AuthorizationGuard],
})
export class AuthModule {}
