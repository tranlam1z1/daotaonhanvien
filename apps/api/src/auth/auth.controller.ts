import {
  BadRequestException,
  Body,
  Controller,
  Header,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AuthOriginGuard,
  clearSession,
  readSession,
  setSession,
} from './auth-http';
import { authField, authPolicy, resetNotice } from './auth-policy';
import { AuthService } from './auth.service';
import { RequirePermission } from './authorization.guard';

@Controller('auth')
@UseGuards(AuthOriginGuard)
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = await this.auth.login(
      authField(body, 'identifier', 320),
      authField(body, 'password', authPolicy.maximumPasswordLength),
      authField(body, 'companyCode', 100),
      request.ip,
    );
    setSession(response, token);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async forgotPassword(@Body() body: unknown) {
    await this.auth.requestReset(
      authField(body, 'email', 320),
      authField(body, 'companyCode', 100),
    );
    return { message: resetNotice };
  }

  @Post('reset-password')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async resetPassword(@Body() body: unknown, @Req() request: Request) {
    const mode = authField(body, 'mode', 10);
    if (mode && mode !== 'invite')
      throw new BadRequestException('Loại đường dẫn không hợp lệ.');
    await this.auth.setPassword(
      authField(body, 'token', 64),
      authField(body, 'password', authPolicy.maximumPasswordLength),
      mode === 'invite' ? 'INVITE' : 'RESET',
      request.ip,
    );
  }

  @Post('change-password')
  @RequirePermission('session.changePassword')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async changePassword(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.changePassword(
      readSession(request),
      authField(body, 'currentPassword', authPolicy.maximumPasswordLength),
      authField(body, 'password', authPolicy.maximumPasswordLength),
    );
    clearSession(response);
  }

  @Post('logout-all')
  @RequirePermission('session.logoutAll')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async logoutAll(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logoutAll(readSession(request));
    clearSession(response);
  }
}
