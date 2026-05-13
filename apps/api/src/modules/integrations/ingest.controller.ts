import {
  Controller, Post, Param, Body, HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';
import { PlanLimitsService } from '../../common/billing/plan-limits.service';
import { IngestLeadDto } from './dto/ingest-lead.dto';

@Controller('ingest')
export class IngestController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly planLimitsService: PlanLimitsService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post(':formToken')
  @HttpCode(HttpStatus.CREATED)
  async ingestLead(
    @Param('formToken') formToken: string,
    @Body() dto: IngestLeadDto,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { formToken },
      select: { id: true, status: true },
    });

    if (!org || org.status !== 'active') {
      throw new BadRequestException('Token inválido');
    }

    await this.planLimitsService.assertLeadAllowed(org.id);

    const lead = await this.prisma.lead.create({
      data: {
        orgId: org.id,
        name: dto.name,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        nicheData: (dto.nicheData ?? {}) as object,
        source: 'form',
        status: 'new',
      },
      select: { id: true, name: true },
    });

    // Fire workflows after HTTP response — prevents LLM latency from blocking the caller
    setImmediate(() => {
      this.eventEmitter.emit('lead.created', {
        orgId: org.id,
        leadId: lead.id,
        leadName: lead.name,
        triggeredBy: 'ingest:form',
        payload: { source: 'form' },
      });
    });

    return { id: lead.id };
  }
}
