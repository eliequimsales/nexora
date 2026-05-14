import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { AiActionsService } from '../ai-actions/ai-actions.service';
import type { LeadEvent } from '../workflows/workflow.engine';
import type { AiPromptsConfig } from '@nexora/shared';

type ClassifiedEvent = LeadEvent & { classification: string };

const NEXT_ACTION: Record<string, string> = {
  hot: 'Entre em contato imediatamente — lead com alto potencial de conversão.',
  warm: 'Agende um follow-up nos próximos 2 dias.',
  cold: 'Inclua no fluxo de nutrição de longo prazo.',
};

@Injectable()
export class SecretaryService {
  private readonly logger = new Logger(SecretaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiActions: AiActionsService,
  ) {}

  @OnEvent('lead.created')
  async onLeadCreated(event: LeadEvent) {
    try {
      const org = await this.prisma.organization.findUnique({
        where: { id: event.orgId },
        select: { settings: true, aiPrompts: true },
      });

      if (!org) return;

      const settings = (org.settings ?? {}) as Record<string, unknown>;
      const secretary = (settings.secretary ?? {}) as Record<string, unknown>;
      if (!secretary.enabled) return;

      const aiPrompts = (org.aiPrompts ?? {}) as Partial<AiPromptsConfig>;
      if (!aiPrompts.classify) {
        this.logger.warn(
          `Secretary skipped classify for lead ${event.leadId}: no classify prompt configured`,
        );
        return;
      }

      await this.aiActions.execute('ai_classify', event.leadId, event.orgId, 'secretary:system');
    } catch (err: any) {
      this.logger.error(`Secretary classify failed for lead ${event.leadId}: ${err?.message}`);
    }
  }

  @OnEvent('lead.classified')
  async onLeadClassified(event: ClassifiedEvent) {
    // Only write briefing for secretary-triggered classifications
    if (event.triggeredBy !== 'secretary:system') return;

    try {
      const org = await this.prisma.organization.findUnique({
        where: { id: event.orgId },
        select: { settings: true },
      });

      const settings = (org?.settings ?? {}) as Record<string, unknown>;
      const secretary = (settings.secretary ?? {}) as Record<string, unknown>;
      if (!secretary.enabled) return;

      const lead = await this.prisma.lead.findUnique({
        where: { id: event.leadId },
        select: { name: true, source: true, aiScore: true, email: true, phone: true },
      });
      if (!lead) return;

      const score = lead.aiScore != null ? ` | Score: ${lead.aiScore}/100` : '';
      const contact = [lead.email, lead.phone].filter(Boolean).join(' · ');
      const suggestion =
        NEXT_ACTION[event.classification] ?? 'Revise manualmente e defina a próxima ação.';

      const payload = event.payload as Record<string, unknown>;
      const justification = typeof payload?.justification === 'string' ? payload.justification : null;

      const lines = [
        `Secretária — análise automática`,
        ``,
        `Lead: ${lead.name}${contact ? ` (${contact})` : ''}`,
        `Origem: ${lead.source}`,
        `Classificação: ${event.classification}${score}`,
        ...(justification ? [`Análise: ${justification}`] : []),
        ``,
        `Próxima ação: ${suggestion}`,
      ];

      await this.prisma.activityLog.create({
        data: {
          orgId: event.orgId,
          leadId: event.leadId,
          userId: null,
          type: 'secretary_briefing',
          content: lines.join('\n'),
          metadata: {
            classification: event.classification,
            score: lead.aiScore,
            source: lead.source,
            triggeredBy: 'secretary:system',
          },
        },
      });

      this.logger.log(`Secretary briefing created for lead ${event.leadId}`);
    } catch (err: any) {
      this.logger.error(`Secretary briefing failed for lead ${event.leadId}: ${err?.message}`);
    }
  }
}
