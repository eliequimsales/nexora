import { Controller, Get, Post, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsPeriodDto } from './dto/analytics-period.dto';
import { RequirePermission } from '../../common/rbac/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @RequirePermission('analytics:read')
  getSummary(@CurrentUser() ctx: TenantContext, @Query() params: AnalyticsPeriodDto) {
    const range = this.analyticsService.parsePeriod(params.period, params.from, params.to);
    return this.analyticsService.getSummary(ctx.orgId, range);
  }

  @Get('funnel')
  @RequirePermission('analytics:read')
  getFunnel(@CurrentUser() ctx: TenantContext) {
    return this.analyticsService.getFunnel(ctx.orgId);
  }

  @Get('proposals')
  @RequirePermission('analytics:read')
  getProposalStats(@CurrentUser() ctx: TenantContext, @Query() params: AnalyticsPeriodDto) {
    const range = this.analyticsService.parsePeriod(params.period, params.from, params.to);
    return this.analyticsService.getProposalStats(ctx.orgId, range);
  }

  @Get('ai')
  @RequirePermission('analytics:read')
  getAiStats(@CurrentUser() ctx: TenantContext, @Query() params: AnalyticsPeriodDto) {
    const range = this.analyticsService.parsePeriod(params.period, params.from, params.to);
    return this.analyticsService.getAiStats(ctx.orgId, range);
  }

  @Post('ai-summary')
  @RequirePermission('analytics:read')
  async generateAiSummary(@CurrentUser() ctx: TenantContext, @Query() params: AnalyticsPeriodDto) {
    const range = this.analyticsService.parsePeriod(params.period, params.from, params.to);
    const summary = await this.analyticsService.getSummary(ctx.orgId, range);
    return this.analyticsService.generateAiSummary(summary, params.period ?? '7d');
  }
}
