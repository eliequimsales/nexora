import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type {
  DashboardSummaryDto,
  DashboardActivityDto,
  NexoraMetricsDto,
  NexoraAnalyticsDto,
  TrendPointDto,
  ChannelStatsDto,
  NexoraResponsesDto,
} from './dto/dashboard-response.dto';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(ctx: TenantContext): Promise<DashboardSummaryDto> {
    const { orgId } = ctx;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalLeads,
      newLeads,
      qualifiedLeads,
      hotLeads,
      pendingTasks,
      overdueTasks,
      aiToday,
      aiSuccessToday,
      members,
    ] = await Promise.all([
      this.prisma.lead.count({ where: { orgId, archivedAt: null } }),
      this.prisma.lead.count({ where: { orgId, status: 'new', archivedAt: null } }),
      this.prisma.lead.count({ where: { orgId, status: 'qualified', archivedAt: null } }),
      this.prisma.lead.count({ where: { orgId, aiClassification: 'hot', archivedAt: null } }),
      this.prisma.task.count({ where: { orgId, status: 'pending' } }),
      this.prisma.task.count({
        where: { orgId, status: 'pending', dueDate: { lt: new Date() } },
      }),
      this.prisma.aiExecution.count({ where: { orgId, createdAt: { gte: todayStart } } }),
      this.prisma.aiExecution.count({
        where: { orgId, status: 'success', createdAt: { gte: todayStart } },
      }),
      this.prisma.user.count({ where: { orgId, status: 'active' } }),
    ]);

    const successRate = aiToday > 0 ? Math.round((aiSuccessToday / aiToday) * 100) : 0;

    return {
      leads: { total: totalLeads, new: newLeads, qualified: qualifiedLeads, hot: hotLeads },
      tasks: { pending: pendingTasks, overdue: overdueTasks },
      ai: { executionsToday: aiToday, successToday: aiSuccessToday, successRate },
      members,
    };
  }

  async getActivity(ctx: TenantContext): Promise<DashboardActivityDto> {
    const logs = await this.prisma.activityLog.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: {
        lead: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return {
      items: logs.map((log) => ({
        id: log.id,
        type: log.type,
        content: log.content,
        leadId: log.lead.id,
        leadName: log.lead.name,
        userId: log.userId,
        userName: log.user?.name ?? null,
        userAvatarUrl: log.user?.avatarUrl ?? null,
        createdAt: log.createdAt,
      })),
    };
  }

  /**
   * Métricas específicas para o modo Nexora — foco em recuperação de clientes.
   * Retorna dados prontos para o dashboard de recuperação.
   */
  async getNexoraMetrics(ctx: TenantContext): Promise<NexoraMetricsDto> {
    const { orgId } = ctx;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Clientes inativos (30+ dias, excluding closed/archived)
    const inactiveThreshold = new Date();
    inactiveThreshold.setDate(inactiveThreshold.getDate() - 30);

    const [
      inactiveCount,
      recoveredToday,
      recoveredThisMonth,
      successfulRecoveriesThisMonth,
      confirmedRecoveriesThisMonth,
      revenueAggregate,
    ] = await Promise.all([
      // Inativos: sem atividade há 30+ dias, status não final, sem opt-out
      this.prisma.lead.count({
        where: {
          orgId,
          archivedAt: null,
          optedOutAt: null,
          status: { notIn: ['closed_lost', 'closed_won'] },
          updatedAt: { lt: inactiveThreshold },
        },
      }),
      // Recuperações tentadas hoje (tipo = recovery_sent)
      this.prisma.activityLog.count({
        where: {
          orgId,
          type: 'recovery_sent',
          createdAt: { gte: todayStart },
        },
      }),
      // Recuperações tentadas este mês
      this.prisma.activityLog.count({
        where: {
          orgId,
          type: 'recovery_sent',
          createdAt: { gte: monthStart },
        },
      }),
      // Recuperações bem-sucedidas este mês (metadata.success = true)
      this.prisma.activityLog.count({
        where: {
          orgId,
          type: 'recovery_sent',
          createdAt: { gte: monthStart },
          metadata: {
            path: ['success'],
            equals: true,
          },
        },
      }),
      // Confirmadas pelo barbeiro este mês (leads.recoveredAt)
      this.prisma.lead.count({
        where: {
          orgId,
          recoveredAt: { gte: monthStart },
        },
      }),
      // Soma de receita REAL recuperada este mês (leads.recoveredValue)
      this.prisma.lead.aggregate({
        where: {
          orgId,
          recoveredAt: { gte: monthStart },
        },
        _sum: { recoveredValue: true },
      }),
    ]);

    const successRate =
      recoveredThisMonth > 0
        ? Math.round((successfulRecoveriesThisMonth / recoveredThisMonth) * 100)
        : 0;

    // R$ estimado = inactiveCount × R$80 (ticket médio barbearia) — POTENCIAL
    const estimatedRevenue = inactiveCount * 80;

    // R$ real recuperado este mês (soma de leads.recovered_value)
    const realRecoveredRevenue = Number(revenueAggregate._sum.recoveredValue ?? 0);

    return {
      recovery: {
        inactiveCount,
        recoveredToday,
        recoveredThisMonth,
        successRate,
        estimatedRevenue,
        confirmedRecoveriesThisMonth,
        realRecoveredRevenue,
      },
    };
  }

  /**
   * Analytics completa para Nexora — inclui tendências de 30 dias, estatísticas por canal e insights.
   */
  async getNexoraAnalytics(ctx: TenantContext): Promise<NexoraAnalyticsDto> {
    const { orgId } = ctx;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const inactiveThreshold = new Date();
    inactiveThreshold.setDate(inactiveThreshold.getDate() - 30);

    // KPIs atuais
    const metrics = await this.getNexoraMetrics(ctx);
    const kpis = metrics.recovery;

    // Recuperações dos últimos 30 dias agrupadas por dia
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const dailyRecoveries = await this.prisma.$queryRaw<
      Array<{ date: Date; count: bigint; success: bigint }>
    >`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count,
        COUNT(CASE WHEN metadata->>'success' = 'true' THEN 1 END) as success
      FROM activity_log
      WHERE org_id = ${orgId}
        AND type = 'recovery_sent'
        AND created_at >= ${last30Days}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Construir trends de recuperações
    const recoveryTrends: TrendPointDto[] = dailyRecoveries.map((d) => ({
      date: d.date.toISOString().split('T')[0],
      value: Number(d.count),
    }));

    // Construir trends de receita (basado em recuperações bem-sucedidas × R$80)
    const revenueTrends: TrendPointDto[] = dailyRecoveries.map((d) => ({
      date: d.date.toISOString().split('T')[0],
      value: Number(d.success) * 80,
    }));

    // Estatísticas por canal
    const channelStats = await this.prisma.$queryRaw<
      Array<{ channel: string; sent: bigint; responded: bigint }>
    >`
      SELECT
        metadata->>'channel' as channel,
        COUNT(*) as sent,
        COUNT(CASE WHEN metadata->>'success' = 'true' THEN 1 END) as responded
      FROM activity_log
      WHERE org_id = ${orgId}
        AND type = 'recovery_sent'
        AND created_at >= ${monthStart}
      GROUP BY metadata->>'channel'
    `;

    const channels: ChannelStatsDto[] = (channelStats || []).map((cs) => {
      const sent = Number(cs.sent);
      const responded = Number(cs.responded);
      return {
        channel: (cs.channel || 'whatsapp') as 'whatsapp' | 'email',
        sent,
        responded,
        successRate: sent > 0 ? Math.round((responded / sent) * 100) : 0,
      };
    });

    // Calcular insights
    let bestDay = 'N/A';
    let maxRecoveries = 0;
    dailyRecoveries.forEach((d) => {
      const count = Number(d.count);
      if (count > maxRecoveries) {
        maxRecoveries = count;
        bestDay = d.date.toISOString().split('T')[0];
      }
    });

    const bestChannel =
      channels.length > 0
        ? channels.reduce((prev, curr) =>
            curr.successRate > prev.successRate ? curr : prev,
          ).channel
        : 'whatsapp';

    // Placeholder: topMessage (em produção, agregar dados de feedback)
    const topMessage = null;

    // Estimativa de dias até reativação (baseado em responseTime médio)
    const avgTimeToReactivation = 2; // placeholder

    return {
      kpis,
      trends: {
        recoveries: recoveryTrends,
        revenue: revenueTrends,
      },
      channels,
      insights: {
        bestDay,
        bestChannel,
        topMessage,
        avgTimeToReactivation,
      },
    };
  }

  /**
   * Respostas de clientes a mensagens de recuperação.
   * Retorna lista de recovery_sent logs com status de resposta.
   */
  async getNexoraResponses(ctx: TenantContext): Promise<NexoraResponsesDto> {
    const { orgId } = ctx;

    // Buscar logs de recovery_sent com dados do lead
    const responses = await this.prisma.activityLog.findMany({
      where: {
        orgId,
        type: 'recovery_sent',
      },
      include: {
        lead: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const items = responses.map((log) => ({
      id: log.id,
      leadId: log.lead.id,
      leadName: log.lead.name,
      channel: ((log.metadata as any)?.channel || 'whatsapp') as 'whatsapp' | 'email',
      sentAt: log.createdAt,
      respondedAt: ((log.metadata as any)?.respondedAt
        ? new Date((log.metadata as any).respondedAt)
        : null),
      responded: ((log.metadata as any)?.success ?? false) as boolean,
      message: log.content,
      response: (log.metadata as any)?.response ?? null,
    }));

    const total = responses.length;
    const responded = responses.filter((r) => ((r.metadata as any)?.success ?? false)).length;

    return {
      items,
      total,
      responded,
    };
  }
}
