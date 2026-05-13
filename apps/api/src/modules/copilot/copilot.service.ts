import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../ai-actions/llm.service';

export type CopilotSuggestionType =
  | 'unclassified_leads'
  | 'hot_no_response'
  | 'stale_no_followup'
  | 'inactive_workflow'
  | 'pipeline_stalled';

export interface CopilotSuggestion {
  type: CopilotSuggestionType;
  title: string;
  reason: string;
  count: number;
  leadIds: string[];
  workflowId?: string;
  workflowName?: string;
  priority: 1 | 2 | 3;
}

@Injectable()
export class CopilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async getSuggestions(orgId: string): Promise<CopilotSuggestion[]> {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [unclassified, hotNoFollowup, staleNoFollowup, inactiveWorkflows, stalePipeline] =
      await Promise.all([
        this.prisma.lead.findMany({
          where: { orgId, aiClassification: null, archivedAt: null },
          select: { id: true },
          take: 50,
        }),

        this.prisma.lead.findMany({
          where: { orgId, aiClassification: 'hot', followUpCount: 0, archivedAt: null },
          select: { id: true },
          take: 50,
        }),

        this.prisma.lead.findMany({
          where: {
            orgId,
            followUpCount: 0,
            createdAt: { lt: threeDaysAgo },
            archivedAt: null,
            aiClassification: { not: null },
          },
          select: { id: true },
          take: 50,
        }),

        this.prisma.workflow.findMany({
          where: {
            orgId,
            actionType: { in: ['ai_follow_up', 'ai_respond'] },
            isActive: false,
          },
          select: { id: true, name: true, actionType: true },
          take: 3,
        }),

        this.prisma.lead.findMany({
          where: {
            orgId,
            pipelineStageId: { not: null },
            updatedAt: { lt: sevenDaysAgo },
            archivedAt: null,
          },
          select: { id: true },
          take: 50,
        }),
      ]);

    const suggestions: CopilotSuggestion[] = [];

    if (unclassified.length > 0) {
      const n = unclassified.length;
      suggestions.push({
        type: 'unclassified_leads',
        title: `${n} lead${n > 1 ? 's' : ''} sem classificação`,
        reason: 'Classificar permite priorizar o atendimento e acionar workflows automaticamente.',
        count: n,
        leadIds: unclassified.map((l) => l.id),
        priority: 1,
      });
    }

    if (hotNoFollowup.length > 0) {
      const n = hotNoFollowup.length;
      suggestions.push({
        type: 'hot_no_response',
        title: `${n} lead${n > 1 ? 's' : ''} quente${n > 1 ? 's' : ''} sem resposta`,
        reason: 'Leads quentes sem contato perdem temperatura rapidamente.',
        count: n,
        leadIds: hotNoFollowup.map((l) => l.id),
        priority: 1,
      });
    }

    if (staleNoFollowup.length > 0) {
      const n = staleNoFollowup.length;
      suggestions.push({
        type: 'stale_no_followup',
        title: `${n} lead${n > 1 ? 's' : ''} há 3+ dias sem follow-up`,
        reason: 'Entraram mas nunca receberam retorno da IA.',
        count: n,
        leadIds: staleNoFollowup.map((l) => l.id),
        priority: 2,
      });
    }

    for (const wf of inactiveWorkflows) {
      const label = wf.actionType === 'ai_follow_up' ? 'follow-up' : 'resposta';
      suggestions.push({
        type: 'inactive_workflow',
        title: `Workflow "${wf.name}" está inativo`,
        reason: `Workflow de ${label} desligado pode estar deixando leads sem atendimento.`,
        count: 1,
        leadIds: [],
        workflowId: wf.id,
        workflowName: wf.name,
        priority: 3,
      });
    }

    if (stalePipeline.length > 0) {
      const n = stalePipeline.length;
      suggestions.push({
        type: 'pipeline_stalled',
        title: `${n} lead${n > 1 ? 's' : ''} parado${n > 1 ? 's' : ''} no pipeline`,
        reason: 'Sem movimento há mais de 7 dias. Revise ou archive.',
        count: n,
        leadIds: stalePipeline.map((l) => l.id),
        priority: 3,
      });
    }

    return suggestions.sort((a, b) => a.priority - b.priority);
  }

  async ask(orgId: string, question: string, leadId?: string): Promise<{ answer: string }> {
    let context = '';

    if (leadId) {
      const lead = await this.prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          orgId: true, name: true, email: true, phone: true,
          status: true, aiClassification: true, aiScore: true,
          source: true, createdAt: true,
        },
      });

      if (!lead || lead.orgId !== orgId) {
        throw new NotFoundException('Lead não encontrado');
      }

      context = [
        `Lead: ${lead.name}`,
        `Status: ${lead.status}`,
        lead.aiClassification ? `Temperatura: ${lead.aiClassification}` : null,
        lead.aiScore != null ? `Score de IA: ${lead.aiScore}` : null,
        lead.email ? `Email: ${lead.email}` : null,
        lead.phone ? `Telefone: ${lead.phone}` : null,
        `Origem: ${lead.source}`,
        `Criado em: ${lead.createdAt.toLocaleDateString('pt-BR')}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    const prompt = context
      ? `Você é um assistente de CRM especializado em vendas. Com base nos dados do lead a seguir, responda de forma direta e prática.\n\nDados do lead:\n${context}\n\nPergunta do vendedor: ${question}\n\nResposta:`
      : `Você é um assistente de CRM especializado em vendas. Responda de forma direta e prática.\n\nPergunta: ${question}\n\nResposta:`;

    const result = await this.llm.call(prompt);
    return { answer: result.content };
  }
}
