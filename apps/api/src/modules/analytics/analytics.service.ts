import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../ai-actions/llm.service';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface AnalyticsSummary {
  period: { from: string; to: string };
  leads: {
    total: number;
    new: number;
    qualified: number;
    closedWon: number;
    closedLost: number;
    hot: number;
    warm: number;
    cold: number;
    unclassified: number;
  };
  proposals: {
    total: number;
    sent: number;
    viewed: number;
    accepted: number;
    rejected: number;
    acceptanceRate: number;
    totalAcceptedRevenue: number;
  };
  ai: {
    executionsTotal: number;
    executionsSuccess: number;
    executionsFailed: number;
    successRate: number;
  };
  workflows: {
    executionsTotal: number;
    executionsSuccess: number;
    executionsFailed: number;
    successRate: number;
  };
}

export interface FunnelStage {
  stageId: string;
  stageName: string;
  stageType: string;
  color: string;
  position: number;
  count: number;
}

export interface ProposalStats {
  byStatus: { status: string; count: number; totalAmount: number }[];
  avgAcceptedAmount: number;
  avgResponseDays: number | null;
}

export interface AiStats {
  byActionType: { actionType: string; total: number; success: number; failed: number; successRate: number }[];
  tokensUsed: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  parsePeriod(period?: string, from?: string, to?: string): DateRange {
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        throw new BadRequestException('Parâmetros de data inválidos');
      }
      if (fromDate > toDate) {
        throw new BadRequestException('"from" deve ser anterior a "to"');
      }
      return { from: fromDate, to: toDate };
    }
    const days = period === '90d' ? 90 : period === '30d' ? 30 : 7;
    const now = new Date();
    return { from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000), to: now };
  }

  async getSummary(orgId: string, range: DateRange): Promise<AnalyticsSummary> {
    const { from, to } = range;

    const [leadsByStatus, leadsByClassification, proposalGroups, aiGroups, workflowGroups] =
      await Promise.all([
        this.prisma.lead.groupBy({
          by: ['status'],
          where: { orgId, createdAt: { gte: from, lte: to }, archivedAt: null },
          _count: { id: true },
        }),

        this.prisma.lead.groupBy({
          by: ['aiClassification'],
          where: { orgId, createdAt: { gte: from, lte: to }, archivedAt: null },
          _count: { id: true },
        }),

        this.prisma.proposal.groupBy({
          by: ['status'],
          where: { orgId, createdAt: { gte: from, lte: to }, archivedAt: null },
          _count: { id: true },
          _sum: { totalAmount: true },
        }),

        this.prisma.aiExecution.groupBy({
          by: ['status'],
          where: { orgId, createdAt: { gte: from, lte: to } },
          _count: { id: true },
        }),

        this.prisma.workflowExecution.groupBy({
          by: ['status'],
          where: { orgId, executedAt: { gte: from, lte: to } },
          _count: { id: true },
        }),
      ]);

    const countByStatus = (rows: { status: string; _count: { id: number } }[], status: string) =>
      rows.find((r) => r.status === status)?._count.id ?? 0;

    const countByClass = (
      rows: { aiClassification: string | null; _count: { id: number } }[],
      cls: string | null,
    ) => rows.find((r) => r.aiClassification === cls)?._count.id ?? 0;

    const totalLeads = leadsByStatus.reduce((s, r) => s + r._count.id, 0);

    const acceptedRow = proposalGroups.find((r) => r.status === 'accepted');
    const acceptedCount = acceptedRow?._count.id ?? 0;
    const sentRows = proposalGroups.filter((r) => ['sent', 'viewed', 'accepted', 'rejected'].includes(r.status));
    const sentTotal = sentRows.reduce((s, r) => s + r._count.id, 0);
    const acceptanceRate = sentTotal > 0 ? Math.round((acceptedCount / sentTotal) * 100) : 0;
    const totalAcceptedRevenue = Number(acceptedRow?._sum?.totalAmount ?? 0);

    const totalProposals = proposalGroups.reduce((s, r) => s + r._count.id, 0);

    const aiTotal = aiGroups.reduce((s, r) => s + r._count.id, 0);
    const aiSuccess = countByStatus(aiGroups, 'success');
    const aiFailed = countByStatus(aiGroups, 'failed');

    const wfTotal = workflowGroups.reduce((s, r) => s + r._count.id, 0);
    const wfSuccess = countByStatus(workflowGroups, 'success');
    const wfFailed = countByStatus(workflowGroups, 'failed');

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      leads: {
        total: totalLeads,
        new: countByStatus(leadsByStatus, 'new'),
        qualified: countByStatus(leadsByStatus, 'qualified'),
        closedWon: countByStatus(leadsByStatus, 'closed_won'),
        closedLost: countByStatus(leadsByStatus, 'closed_lost'),
        hot: countByClass(leadsByClassification, 'hot'),
        warm: countByClass(leadsByClassification, 'warm'),
        cold: countByClass(leadsByClassification, 'cold'),
        unclassified: countByClass(leadsByClassification, null),
      },
      proposals: {
        total: totalProposals,
        sent: countByStatus(proposalGroups, 'sent'),
        viewed: countByStatus(proposalGroups, 'viewed'),
        accepted: acceptedCount,
        rejected: countByStatus(proposalGroups, 'rejected'),
        acceptanceRate,
        totalAcceptedRevenue,
      },
      ai: {
        executionsTotal: aiTotal,
        executionsSuccess: aiSuccess,
        executionsFailed: aiFailed,
        successRate: aiTotal > 0 ? Math.round((aiSuccess / aiTotal) * 100) : 0,
      },
      workflows: {
        executionsTotal: wfTotal,
        executionsSuccess: wfSuccess,
        executionsFailed: wfFailed,
        successRate: wfTotal > 0 ? Math.round((wfSuccess / wfTotal) * 100) : 0,
      },
    };
  }

  async getFunnel(orgId: string): Promise<FunnelStage[]> {
    const stages = await this.prisma.pipelineStage.findMany({
      where: { orgId },
      orderBy: { position: 'asc' },
      include: { _count: { select: { leads: { where: { archivedAt: null } } } } },
    });

    return stages.map((s) => ({
      stageId: s.id,
      stageName: s.name,
      stageType: s.stageType,
      color: s.color,
      position: s.position,
      count: s._count.leads,
    }));
  }

  async getProposalStats(orgId: string, range: DateRange): Promise<ProposalStats> {
    const { from, to } = range;

    const groups = await this.prisma.proposal.groupBy({
      by: ['status'],
      where: { orgId, createdAt: { gte: from, lte: to }, archivedAt: null },
      _count: { id: true },
      _sum: { totalAmount: true },
    });

    const acceptedProposals = await this.prisma.proposal.findMany({
      where: { orgId, status: 'accepted', respondedAt: { not: null }, sentAt: { not: null } },
      select: { sentAt: true, respondedAt: true, totalAmount: true },
      take: 100,
    });

    let avgResponseDays: number | null = null;
    if (acceptedProposals.length > 0) {
      const totalDays = acceptedProposals.reduce((sum, p) => {
        const diff = p.respondedAt!.getTime() - p.sentAt!.getTime();
        return sum + diff / (1000 * 60 * 60 * 24);
      }, 0);
      avgResponseDays = Math.round(totalDays / acceptedProposals.length);
    }

    const acceptedGroup = groups.find((g) => g.status === 'accepted');
    const avgAcceptedAmount =
      acceptedGroup && acceptedGroup._count.id > 0
        ? Number(acceptedGroup._sum?.totalAmount ?? 0) / acceptedGroup._count.id
        : 0;

    return {
      byStatus: groups.map((g) => ({
        status: g.status,
        count: g._count.id,
        totalAmount: Number(g._sum?.totalAmount ?? 0),
      })),
      avgAcceptedAmount,
      avgResponseDays,
    };
  }

  async getAiStats(orgId: string, range: DateRange): Promise<AiStats> {
    const { from, to } = range;

    const [byAction, tokenSum] = await Promise.all([
      this.prisma.aiExecution.groupBy({
        by: ['actionType', 'status'],
        where: { orgId, createdAt: { gte: from, lte: to } },
        _count: { id: true },
      }),

      this.prisma.aiExecution.aggregate({
        where: { orgId, createdAt: { gte: from, lte: to }, status: 'success' },
        _sum: { tokensInput: true, tokensOutput: true },
      }),
    ]);

    const actionMap: Record<string, { total: number; success: number; failed: number }> = {};
    for (const row of byAction) {
      if (!actionMap[row.actionType]) {
        actionMap[row.actionType] = { total: 0, success: 0, failed: 0 };
      }
      actionMap[row.actionType].total += row._count.id;
      if (row.status === 'success') actionMap[row.actionType].success += row._count.id;
      if (row.status === 'failed') actionMap[row.actionType].failed += row._count.id;
    }

    return {
      byActionType: Object.entries(actionMap).map(([actionType, counts]) => ({
        actionType,
        ...counts,
        successRate: counts.total > 0 ? Math.round((counts.success / counts.total) * 100) : 0,
      })),
      tokensUsed: (tokenSum._sum.tokensInput ?? 0) + (tokenSum._sum.tokensOutput ?? 0),
    };
  }

  async generateAiSummary(summary: AnalyticsSummary, period: string): Promise<string> {
    const { leads, proposals, ai, workflows } = summary;

    const prompt = `Você é um analista de negócios da Nexora, plataforma de automação comercial.
Analise os dados abaixo do período "${period}" e produza um resumo executivo em português.

LEADS:
- Total no período: ${leads.total}
- Novos: ${leads.new} | Qualificados: ${leads.qualified}
- Fechados (ganhos): ${leads.closedWon} | Fechados (perdidos): ${leads.closedLost}
- Quentes: ${leads.hot} | Mornos: ${leads.warm} | Frios: ${leads.cold} | Sem classificação: ${leads.unclassified}

PROPOSTAS:
- Total: ${proposals.total} | Enviadas: ${proposals.sent} | Visualizadas: ${proposals.viewed}
- Aceitas: ${proposals.accepted} | Recusadas: ${proposals.rejected}
- Taxa de aceitação: ${proposals.acceptanceRate}%
- Receita fechada: R$ ${proposals.totalAcceptedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

IA:
- Execuções: ${ai.executionsTotal} | Sucesso: ${ai.successRate}%

WORKFLOWS:
- Execuções: ${workflows.executionsTotal} | Sucesso: ${workflows.successRate}%

Seja direto. Máximo 3 frases. Destaque o ponto mais importante (positivo ou negativo). Não use jargão técnico.`;

    const result = await this.llm.call(prompt);
    return result.content;
  }
}
