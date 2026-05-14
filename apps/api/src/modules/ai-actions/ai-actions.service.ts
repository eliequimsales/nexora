import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from './llm.service';
import { PromptService, type AssistantPersona } from './prompt.service';
import { ResponseParser } from './response-parser';
import type { TenantContext } from '../../common/tenant/tenant-context';
import type { AiPromptsConfig } from '@nexora/shared';

export type AiActionType = 'ai_classify' | 'ai_respond' | 'ai_follow_up';

export interface AiActionResult {
  executionId: string;
  actionType: AiActionType;
  status: 'success' | 'failed';
  result: Record<string, unknown>;
  errorMessage?: string;
}

@Injectable()
export class AiActionsService {
  private readonly logger = new Logger(AiActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly promptService: PromptService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(
    actionType: AiActionType,
    leadId: string,
    orgId: string,
    triggeredBy: string,
  ): Promise<AiActionResult> {
    const [lead, org] = await Promise.all([
      this.prisma.lead.findUnique({ where: { id: leadId } }),
      this.prisma.organization.findUnique({ where: { id: orgId } }),
    ]);

    if (!lead || lead.orgId !== orgId) throw new NotFoundException('Lead não encontrado');
    if (!org) throw new NotFoundException('Organização não encontrada');

    const aiPrompts = org.aiPrompts as Partial<AiPromptsConfig>;
    const promptKey = this.resolvePromptKey(actionType);
    const template = aiPrompts[promptKey];

    if (!template) {
      throw new BadRequestException(
        `Prompt "${promptKey}" não configurado para este org. Configure em Configurações → IA.`,
      );
    }

    // Build activity history for follow_up
    let activityHistory = '';
    if (actionType === 'ai_follow_up') {
      const logs = await this.prisma.activityLog.findMany({
        where: { leadId, orgId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { type: true, content: true, createdAt: true },
      });
      activityHistory = logs
        .map((l) => `[${l.createdAt.toLocaleDateString('pt-BR')}] ${l.content}`)
        .join('\n');
    }

    const orgSettings = (org.settings ?? {}) as Record<string, unknown>;
    const persona = (orgSettings.assistant ?? {}) as AssistantPersona;
    const variables = this.promptService.buildVariables(lead, activityHistory, persona);
    const prompt = this.promptService.build(template, variables);
    const promptVersion = `${promptKey}_${Buffer.from(template).slice(0, 8).toString('hex')}`;

    // Create execution record as pending
    const execution = await this.prisma.aiExecution.create({
      data: {
        orgId,
        leadId,
        triggerType: triggeredBy.startsWith('workflow:') ? triggeredBy : 'manual',
        actionType: actionType.replace('ai_', ''),
        promptVersion,
        leadVariablesUsed: variables as object,
        status: 'pending',
      },
    });

    try {
      const llmResult = await this.llm.call(prompt);
      const { result, leadUpdates, activityType, activityContent } =
        this.applyResult(actionType, llmResult.content, lead);

      // Apply lead updates atomically with AiExecution update
      await this.prisma.$transaction([
        this.prisma.aiExecution.update({
          where: { id: execution.id },
          data: {
            llmResponse: llmResult.content,
            status: 'success',
            tokensInput: llmResult.tokensInput,
            tokensOutput: llmResult.tokensOutput,
            latencyMs: llmResult.latencyMs,
          },
        }),
        ...(Object.keys(leadUpdates).length > 0
          ? [this.prisma.lead.update({ where: { id: leadId }, data: leadUpdates })]
          : []),
        this.prisma.activityLog.create({
          data: {
            orgId,
            leadId,
            userId: null,
            type: activityType,
            content: activityContent,
            metadata: { executionId: execution.id, actionType },
          },
        }),
      ]);

      // Emit events after successful classification
      if (actionType === 'ai_classify' && leadUpdates.aiClassification) {
        this.eventEmitter.emit('lead.classified', {
          orgId,
          leadId,
          leadName: lead.name,
          triggeredBy,
          classification: leadUpdates.aiClassification,
          payload: result,
        });
      }

      return { executionId: execution.id, actionType, status: 'success', result };
    } catch (err: any) {
      await this.prisma.aiExecution.update({
        where: { id: execution.id },
        data: { status: 'failed', errorMessage: err.message },
      });

      this.logger.error(`AI action ${actionType} failed for lead ${leadId}: ${err.message}`);
      return {
        executionId: execution.id,
        actionType,
        status: 'failed',
        result: {},
        errorMessage: err.message,
      };
    }
  }

  private resolvePromptKey(actionType: AiActionType): keyof AiPromptsConfig {
    const map: Record<AiActionType, keyof AiPromptsConfig> = {
      ai_classify: 'classify',
      ai_respond: 'respond',
      ai_follow_up: 'followUp',
    };
    return map[actionType];
  }

  private applyResult(
    actionType: AiActionType,
    rawContent: string,
    lead: any,
  ): {
    result: Record<string, unknown>;
    leadUpdates: Record<string, unknown>;
    activityType: string;
    activityContent: string;
  } {
    switch (actionType) {
      case 'ai_classify': {
        const parsed = ResponseParser.parseClassify(rawContent);
        return {
          result: parsed as unknown as Record<string, unknown>,
          leadUpdates: { aiClassification: parsed.classification, aiScore: parsed.score },
          activityType: 'lead_classified',
          activityContent: `IA classificou como ${parsed.classification} (score ${parsed.score}): ${parsed.justification}`,
        };
      }

      case 'ai_respond': {
        const parsed = ResponseParser.parseRespond(rawContent);
        return {
          result: parsed as unknown as Record<string, unknown>,
          leadUpdates: {},
          activityType: 'ai_response',
          activityContent: parsed.message,
        };
      }

      case 'ai_follow_up': {
        const parsed = ResponseParser.parseRespond(rawContent);
        return {
          result: parsed as unknown as Record<string, unknown>,
          leadUpdates: { followUpCount: lead.followUpCount + 1 },
          activityType: 'ai_follow_up',
          activityContent: parsed.message,
        };
      }

      default:
        throw new Error(`Unknown AI action type: ${actionType}`);
    }
  }
}
