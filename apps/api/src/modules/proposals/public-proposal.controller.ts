import { Controller, Get, Post, Param, Body, Req, HttpCode, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { ProposalsService } from './proposals.service';

class RespondProposalDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

@Controller('proposals/p')
export class PublicProposalController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Get(':token')
  @Public()
  async getByToken(@Param('token') token: string, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket.remoteAddress ?? null;
    const userAgent = (req.headers['user-agent'] as string) ?? null;

    // Fire-and-forget view recording — non-blocking
    this.proposalsService.recordView(token, ip, userAgent).catch(() => undefined);

    return this.proposalsService.findByToken(token);
  }

  @Post(':token/accept')
  @Public()
  @HttpCode(HttpStatus.OK)
  accept(@Param('token') token: string) {
    return this.proposalsService.respond(token, 'accept');
  }

  @Post(':token/reject')
  @Public()
  @HttpCode(HttpStatus.OK)
  reject(@Param('token') token: string, @Body() dto: RespondProposalDto) {
    return this.proposalsService.respond(token, 'reject', dto.reason);
  }
}
