import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nexora/api-prisma';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { assertSameTenant } from '../../common/tenant/assert-same-tenant';
import { parsePagination, buildPaginatedResult } from '../../common/helpers/pagination.helper';
import { mapWorkflow, mapExecution } from './dto/workflow-response.dto';
import type { TenantContext } from '../../common/tenant/tenant-context';
import type { CreateWorkflowDto } from './dto/create-workflow.dto';
import type { UpdateWorkflowDto } from './dto/update-workflow.dto';

const asJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(dto: CreateWorkflowDto, ctx: TenantContext) {
    const workflow = await this.prisma.workflow.create({
      data: {
        orgId: ctx.orgId,
        name: dto.name,
        description: dto.description ?? null,
        isActive: dto.isActive ?? true,
        triggerType: dto.triggerType,
        triggerConditions: asJson(dto.triggerConditions ?? {}),
        actionType: dto.actionType,
        actionConfig: asJson(dto.actionConfig ?? {}),
      },
    });

    this.auditLog.record({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      actorRole: ctx.role,
      action: 'workflow.created',
      resourceType: 'workflow',
      resourceId: workflow.id,
      resourceName: workflow.name,
      metadata: { triggerType: workflow.triggerType, actionType: workflow.actionType },
    });

    return mapWorkflow(workflow);
  }

  async findAll(ctx: TenantContext) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const workflows = await this.prisma.workflow.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: 'asc' },
    });

    const stats = await this.prisma.workflowExecution.groupBy({
      by: ['workflowId', 'status'],
      where: {
        orgId: ctx.orgId,
        executedAt: { gte: todayStart },
      },
      _count: true,
    });

    const statMap = new Map<string, { success: number; failed: number; total: number }>();
    for (const s of stats) {
      const current = statMap.get(s.workflowId) ?? { success: 0, failed: 0, total: 0 };
      current.total += s._count;
      if (s.status === 'success') current.success += s._count;
      if (s.status === 'failed') current.failed += s._count;
      statMap.set(s.workflowId, current);
    }

    const workflowIds = workflows.map((w) => w.id);
    const latestExecutions = workflowIds.length
      ? await this.prisma.$queryRaw<Array<{
          workflow_id: string;
          status: string;
          result: unknown;
          error_message: string | null;
          executed_at: Date;
        }>>`
          SELECT DISTINCT ON (workflow_id)
            workflow_id, status, result, error_message, executed_at
          FROM workflow_executions
          WHERE org_id = ${ctx.orgId}::uuid
            AND workflow_id = ANY(${workflowIds}::uuid[])
          ORDER BY workflow_id, executed_at DESC
        `
      : [];

    const latestMap = new Map<string, (typeof latestExecutions)[number]>();
    for (const row of latestExecutions) latestMap.set(row.workflow_id, row);

    return workflows.map((w) => {
      const s = statMap.get(w.id) ?? { success: 0, failed: 0, total: 0 };
      const latest = latestMap.get(w.id);
      return {
        ...mapWorkflow(w),
        executionsToday: s.total,
        successToday: s.success,
        failedToday: s.failed,
        ...(latest && {
          latestExecutionStatus: latest.status as 'success' | 'failed' | 'skipped' | 'pending',
          latestExecutionErrorMessage: latest.error_message,
          latestExecutionResult: (latest.result ?? {}) as Record<string, unknown>,
          latestExecutionAt: latest.executed_at,
        }),
      };
    });
  }

  async findOne(id: string, ctx: TenantContext) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id } });
    if (!workflow) throw new NotFoundException('Workflow não encontrado');
    assertSameTenant(workflow.orgId, ctx.orgId);
    return mapWorkflow(workflow);
  }

  async update(id: string, dto: UpdateWorkflowDto, ctx: TenantContext) {
    const existing = await this.prisma.workflow.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Workflow não encontrado');
    assertSameTenant(existing.orgId, ctx.orgId);

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.triggerType !== undefined && { triggerType: dto.triggerType }),
        ...(dto.triggerConditions !== undefined && { triggerConditions: asJson(dto.triggerConditions) }),
        ...(dto.actionType !== undefined && { actionType: dto.actionType }),
        ...(dto.actionConfig !== undefined && { actionConfig: asJson(dto.actionConfig) }),
      },
    });

    if (dto.isActive !== undefined && dto.isActive !== existing.isActive) {
      this.auditLog.record({
        orgId: ctx.orgId,
        actorId: ctx.userId,
        actorRole: ctx.role,
        action: 'workflow.toggled',
        resourceType: 'workflow',
        resourceId: id,
        resourceName: existing.name,
        metadata: { isActive: dto.isActive },
      });
    }

    return mapWorkflow(updated);
  }

  async remove(id: string, ctx: TenantContext) {
    const existing = await this.prisma.workflow.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Workflow não encontrado');
    assertSameTenant(existing.orgId, ctx.orgId);

    this.auditLog.record({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      actorRole: ctx.role,
      action: 'workflow.deleted',
      resourceType: 'workflow',
      resourceId: id,
      resourceName: existing.name,
      metadata: { actionType: existing.actionType, triggerType: existing.triggerType },
    });

    await this.prisma.workflow.delete({ where: { id } });
  }

  async getExecutions(id: string, ctx: TenantContext, page = 1, limit = 20) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id } });
    if (!workflow) throw new NotFoundException('Workflow não encontrado');
    assertSameTenant(workflow.orgId, ctx.orgId);

    const { skip, take } = parsePagination({ page, limit });
    const [data, total] = await Promise.all([
      this.prisma.workflowExecution.findMany({
        where: { workflowId: id },
        orderBy: { executedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.workflowExecution.count({ where: { workflowId: id } }),
    ]);

    return buildPaginatedResult(data.map(mapExecution), total, page, limit);
  }

  // Called by WorkflowEngine — finds active workflows for an org matching a trigger
  async findActiveByTrigger(orgId: string, triggerType: string) {
    return this.prisma.workflow.findMany({
      where: { orgId, triggerType, isActive: true },
    });
  }

  async logExecution(
    orgId: string,
    workflowId: string,
    leadId: string,
    triggeredBy: string,
    status: 'success' | 'failed' | 'skipped',
    result: Record<string, unknown>,
    errorMessage?: string,
  ) {
    return this.prisma.workflowExecution.create({
      data: {
        orgId,
        workflowId,
        leadId,
        status,
        triggeredBy,
        result: asJson(result),
        errorMessage: errorMessage ?? null,
      },
    });
  }
}
