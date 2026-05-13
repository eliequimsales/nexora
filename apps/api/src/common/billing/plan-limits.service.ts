import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PlanLimitException } from '../exceptions/plan-limit.exception';

export interface PlanLimits {
  leadsPerMonth: number;
  aiExecPerMonth: number;
  maxUsers: number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  starter:  { leadsPerMonth: 200,    aiExecPerMonth: 500,    maxUsers: 3  },
  pro:      { leadsPerMonth: 2000,   aiExecPerMonth: 10000,  maxUsers: 10 },
  business: { leadsPerMonth: 20000,  aiExecPerMonth: 100000, maxUsers: 50 },
  // Orgs without a subscription get the starter limits as a free tier
  free:     { leadsPerMonth: 50,     aiExecPerMonth: 100,    maxUsers: 2  },
};

@Injectable()
export class PlanLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  async assertLeadAllowed(orgId: string): Promise<void> {
    const limits = await this.getLimits(orgId);
    const count = await this.countLeadsThisMonth(orgId);
    if (count >= limits.leadsPerMonth) {
      throw new PlanLimitException('leads');
    }
  }

  async assertAiExecAllowed(orgId: string): Promise<void> {
    const limits = await this.getLimits(orgId);
    const count = await this.countAiExecThisMonth(orgId);
    if (count >= limits.aiExecPerMonth) {
      throw new PlanLimitException('aiExecutions');
    }
  }

  async getUsage(orgId: string) {
    const [leadsThisMonth, aiExecThisMonth, usersCount] = await Promise.all([
      this.countLeadsThisMonth(orgId),
      this.countAiExecThisMonth(orgId),
      this.prisma.user.count({ where: { orgId, status: 'active' } }),
    ]);
    return { leadsThisMonth, aiExecThisMonth, usersCount };
  }

  async getLimits(orgId: string): Promise<PlanLimits> {
    const sub = await this.prisma.subscription.findUnique({
      where: { orgId },
      select: { plan: true, status: true, limits: true },
    });
    if (!sub || sub.status === 'canceled') return PLAN_LIMITS.free;
    const limits = sub.limits as PlanLimits | null;
    return limits ?? PLAN_LIMITS[sub.plan] ?? PLAN_LIMITS.free;
  }

  private async countLeadsThisMonth(orgId: string): Promise<number> {
    const start = this.startOfMonth();
    return this.prisma.lead.count({
      where: { orgId, createdAt: { gte: start } },
    });
  }

  private async countAiExecThisMonth(orgId: string): Promise<number> {
    const start = this.startOfMonth();
    return this.prisma.aiExecution.count({
      where: { orgId, createdAt: { gte: start } },
    });
  }

  private startOfMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}
