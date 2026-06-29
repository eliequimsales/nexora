import { Controller, Post, Get, Body } from '@nestjs/common';
import { Public } from '../../../common/decorators/public.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { AssessmentRequestDto, FeedbackRequestDto, EventRequestDto } from './customer-recovery.dto';
import {
  runCustomerRecoveryAssessment,
  type CustomerRecoveryAssessment,
} from './customer-recovery-assessment';

/**
 * CustomerRecoveryController — a porta do produto.
 *
 * POST /api/v1/customer-recovery/assessment
 * O dono da clínica sobe um CSV → recebe clientes recuperáveis, valor potencial,
 * Top 3 e a ação. Público e stateless: processa o CSV e devolve a análise; nada
 * é persistido nem toca segredo. Validação/limite de tamanho no DTO.
 */
@Controller('customer-recovery')
export class CustomerRecoveryController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Post('assessment')
  async assess(@Body() dto: AssessmentRequestDto): Promise<CustomerRecoveryAssessment> {
    return runCustomerRecoveryAssessment(dto.csv, {
      orgId: dto.orgId ?? 'mvp',
      marginPctDefault: dto.marginPctDefault,
      annualRevenueCents: dto.annualRevenueCents,
    });
  }

  /**
   * Feedback do piloto — gravado no Postgres. Nunca perdido (Etapa 2 do lançamento).
   */
  @Public()
  @Post('feedback')
  async feedback(@Body() dto: FeedbackRequestDto): Promise<{ ok: true }> {
    await this.prisma.customerRecoveryFeedback.create({
      data: {
        rating: dto.rating,
        wouldUseAgain: dto.wouldUseAgain,
        wouldPay: dto.wouldPay,
        priceBand: dto.priceBand,
        whatMissing: dto.whatMissing,
        orgId: dto.orgId,
        orgSlug: dto.orgSlug,
        recoverableCount: dto.recoverableCount,
        totalRecoverableCents: dto.totalRecoverableCents,
        confidencePct: dto.confidencePct,
        version: 'mvp',
      },
    });
    return { ok: true };
  }

  /**
   * Registra um evento de funil (público, fire-and-forget). Sem PII.
   */
  @Public()
  @Post('event')
  async event(@Body() dto: EventRequestDto): Promise<{ ok: true }> {
    await this.prisma.funnelEvent.create({
      data: { name: dto.name, anonId: dto.anonId, orgSlug: dto.orgSlug },
    });
    return { ok: true };
  }

  /**
   * Funil dos últimos 30 dias — contagem por evento. Autenticado (só fundadores).
   */
  @Get('funnel')
  async funnel(): Promise<{ name: string; count: number }[]> {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const grouped = await this.prisma.funnelEvent.groupBy({
      by: ['name'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });
    return grouped.map((g) => ({ name: g.name, count: g._count._all }));
  }
}
