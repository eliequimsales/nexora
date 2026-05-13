import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { DashboardSummaryDto, DashboardActivityDto } from './dto/dashboard-response.dto';
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
}
