import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { LeadInfrastructure } from './leads.infrastructure';
import { parseLead } from './lead-input';

@Controller('public/leads')
export class LeadsController {
  constructor(
    @Inject(LeadInfrastructure)
    private readonly infrastructure: LeadInfrastructure,
  ) {}

  @Post()
  async create(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Express does not trust forwarded headers; the socket address is authoritative.
    const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    let retryAfter: number;
    try {
      retryAfter = await this.infrastructure.consumeLimit(ip);
    } catch {
      throw new ServiceUnavailableException(
        'Chưa thể gửi đăng ký. Vui lòng thử lại sau.',
      );
    }
    if (retryAfter > 0) {
      response.setHeader('Retry-After', retryAfter);
      throw new HttpException(
        'Anh/chị đã gửi quá nhiều lần. Vui lòng thử lại sau.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const input = parseLead(body);
    if (input) {
      try {
        await this.infrastructure.save(input, ip);
      } catch {
        throw new ServiceUnavailableException(
          'Chưa thể gửi đăng ký. Vui lòng thử lại sau.',
        );
      }
    }
    // No IDs, private lead fields or honeypot signal are exposed publicly.
    return { message: 'Đăng ký đã được tiếp nhận.' };
  }
}
