import { Controller, Post, Get, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { AiActionsService } from './ai-actions.service';
import { RequirePermission } from '../../common/rbac/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlanLimit } from '../../common/guards/plan-limits.guard';
import { PrismaService } from '../../database/prisma.service';
import { parsePagination, buildPaginatedResult } from '../../common/helpers/pagination.helper';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Controller('ai-actions')
export class AiActionsController {
  constructor(
    private readonly aiActionsService: AiActionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('classify/:leadId')
  @RequirePermission('leads:update')
  @PlanLimit('aiExecutions')
  @HttpCode(HttpStatus.OK)
  classify(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentUser() ctx: TenantContext,
  ) {
    return this.aiActionsService.execute('ai_classify', leadId, ctx.orgId, ctx.userId);
  }

  @Post('respond/:leadId')
  @RequirePermission('leads:update')
  @PlanLimit('aiExecutions')
  @HttpCode(HttpStatus.OK)
  respond(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentUser() ctx: TenantContext,
  ) {
    return this.aiActionsService.execute('ai_respond', leadId, ctx.orgId, ctx.userId);
  }

  @Post('follow-up/:leadId')
  @RequirePermission('leads:update')
  @PlanLimit('aiExecutions')
  @HttpCode(HttpStatus.OK)
  followUp(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentUser() ctx: TenantContext,
  ) {
    return this.aiActionsService.execute('ai_follow_up', leadId, ctx.orgId, ctx.userId);
  }

  @Get('executions')
  @RequirePermission('leads:read')
  async getExecutions(
    @CurrentUser() ctx: TenantContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('actionType') actionType?: string,
  ) {
    const { skip, take, page: p, limit: l } = parsePagination({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });

    const where: any = { orgId: ctx.orgId };
    if (status) where.status = status;
    if (actionType) where.actionType = actionType;

    const [data, total] = await Promise.all([
      this.prisma.aiExecution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          leadId: true,
          triggerType: true,
          actionType: true,
          promptVersion: true,
          status: true,
          tokensInput: true,
          tokensOutput: true,
          latencyMs: true,
          errorMessage: true,
          createdAt: true,
          lead: { select: { name: true } },
        },
      }),
      this.prisma.aiExecution.count({ where }),
    ]);

    return buildPaginatedResult(data, total, p, l);
  }

  @Get('executions/:id')
  @RequirePermission('leads:read')
  async getExecution(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() ctx: TenantContext,
  ) {
    const execution = await this.prisma.aiExecution.findFirst({
      where: { id, orgId: ctx.orgId },
    });
    if (!execution) {
      throw new NotFoundException('Execução não encontrada');
    }
    return execution;
  }
}
