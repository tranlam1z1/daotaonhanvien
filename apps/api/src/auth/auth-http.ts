import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { authPolicy, sessionCookie, webOrigin } from './auth-policy';
import { AuthService } from './auth.service';

import type { SessionIdentity } from './permissions';

export type SessionRequest = Request & { user?: SessionIdentity };

export function readSession(request: Request) {
  const cookies = request.headers.cookie?.split(';') ?? [];
  const prefix = sessionCookie + '=';
  return (
    cookies
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(prefix))
      ?.slice(prefix.length) ?? ''
  );
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

export function setSession(response: Response, token: string) {
  response.cookie(sessionCookie, token, {
    ...cookieOptions(),
    maxAge: authPolicy.sessionIdleMs,
  });
}

export function clearSession(response: Response) {
  response.clearCookie(sessionCookie, cookieOptions());
}

@Injectable()
export class AuthOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.headers.origin !== webOrigin()) {
      throw new ForbiddenException('Yêu cầu không hợp lệ.');
    }
    return true;
  }
}

/** Establishes the trusted tenant identity before TenantInterceptor opens its transaction. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const http = context.switchToHttp();
    const request = http.getRequest<SessionRequest>();
    const token = readSession(request);
    request.user = await this.auth.authenticate(token);
    const response = http.getResponse<Response>();
    response.setHeader('Cache-Control', 'private, no-store');
    setSession(response, token);
    return true;
  }
}
