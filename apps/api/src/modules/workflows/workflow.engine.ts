import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WorkflowsService } from './workflows.service';
import { PrismaService } from '../../database/prisma.service';
import { AiActionsService } from '../ai-actions/ai-actions.service';
import { JOB_NAMES, QUEUE_NAMES } from '@reshit/shared';
import type { AiActionType } from '../ai-actions/ai-actions.service';

const DEDUPE_WINDOW_MS = 60_000;

export interface LeadEvent {
  orgId: string;
  leadId: string;
  leadName: string;
  triggeredBy: string;
  payload: Record<string, unknown>;
  // optional per-trigger fields
  fromStatus?: string;
  toStatus?: string;
  fromStageId?: string | null;
  toStageId?: string;
  classification?: string;
}

@Injectable()
export class WorkflowEngine {
  private readonly logger = new Logger(WorkflowEngine.name);

  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly prisma: PrismaService,
    private readonly aiActionsService: AiActionsService,
    @InjectQueue(QUEUE_NAMES.WORKFLOWS) private readonly workflowsQueue: Queue,
  ) {}

  // ── Event listeners — enqueue only, no inline execution ──────────────────

  @OnEvent('lead.created')
  async onLeadCreated(event: LeadEvent) {
    await this.workflowsQueue.add(JOB_NAMES.WORKFLOW_TRIGGER, {
      triggerType: 'lead_created',
      event,
    });
  }

  @OnEvent('lead.status_changed')
  async onLeadStatusChanged(event: LeadEvent) {
    await this.workflowsQueue.add(JOB_NAMES.WORKFLOW_TRIGGER, {
      triggerType: 'lead_status_changed',
      event,
    });
  }

  @OnEvent('lead.stage_changed')
  async onLeadStageChanged(event: LeadEvent) {
    await this.workflowsQueue.add(JOB_NAMES.WORKFLOW_TRIGGER, {
      triggerType: 'lead_stage_changed',
      event,
    });
  }

  @OnEvent('lead.classified')
  async onLeadClassified(event: LeadEvent) {
    await this.workflowsQueue.add(JOB_NAMES.WORKFLOW_TRIGGER, {
      triggerType: 'lead_classified',
      event,
    });
  }

  // ── Public API for WorkflowProcessor ────────────────────────────────────

  async processTrigger(triggerType: string, event: LeadEvent): Promise<void> {
    const conditionCheck = this.buildConditionChecker(triggerType, event);
    await this.dispatch(triggerType, event, conditionCheck);
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private buildConditionChecker(triggerType: string, event: LeadEvent) {
    return (conditions: Record<string, unknown>): boolean => {
      switch (triggerType) {
        case 'lead_status_changed':
          if (conditions.fromStatus && conditions.fromStatus !== event.fromStatus) return false;
          if (conditions.toStatus && conditions.toStatus !== event.toStatus) return false;
          return true;
        case 'lead_stage_changed':
          if (conditions.fromStageId && conditions.fromStageId !== event.fromStageId) return false;
          if (conditions.toStageId && conditions.toStageId !== event.toStageId) return false;
          return true;
        case 'lead_classified':
          if (conditions.classification && conditions.classification !== event.classification) return false;
          return true;
        default:
          return true;
      }
    };
  }

  private async dispatch(
    triggerType: string,
    event: LeadEvent,
    conditionCheck: (conditions: Record<string, unknown>) => boolean,
  ) {
    const workflows = await this.workflowsService.findActiveByTrigger(event.orgId, triggerType);

    for (const workflow of workflows) {
      const conditions = workflow.triggerConditions as Record<string, unknown>;
      if (!conditionCheck(conditions)) {
        await this.workflowsService.logExecution(
          event.orgId, workflow.id, event.leadId, event.triggeredBy,
          'skipped', { reason: 'condition_not_met' },
        );
        continue;
      }

      const isDuplicate = await this.hasRecentExecution(event.orgId, workflow.id, event.leadId);
      if (isDuplicate) {
        await this.workflowsService.logExecution(
          event.orgId, workflow.id, event.leadId, event.triggeredBy,
          'skipped', { reason: 'duplicate_recent_execution' },
        );
        this.logger.log(
          `Workflow ${workflow.id} skipped for lead ${event.leadId}: duplicate within ${DEDUPE_WINDOW_MS}ms`,
        );
        continue;
      }

      try {
        const result = await this.executeAction(workflow, event);
        await this.workflowsService.logExecution(
          event.orgId, workflow.id, event.leadId, event.triggeredBy,
          'success', result,
        );
        this.logger.log(`Workflow ${workflow.id} executed for lead ${event.leadId}`);
      } catch (err: any) {
        const errorReason = this.resolveErrorReason(err);
        const result = errorReason ? { errorReason } : {};
        await this.workflowsService.logExecution(
          event.orgId, workflow.id, event.leadId, event.triggeredBy,
          'failed', result, err?.message,
        );
        this.logger.error(`Workflow ${workflow.id} failed for lead ${event.leadId}: ${err?.message}`);
      }
    }
  }

  private async hasRecentExecution(orgId: string, workflowId: string, leadId: string): Promise<boolean> {
    const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const recent = await this.prisma.workflowExecution.findFirst({
      where: { orgId, workflowId, leadId, executedAt: { gte: since } },
      select: { id: true },
    });
    return recent !== null;
  }

  private resolveErrorReason(err: unknown): string | null {
    if (err instanceof BadRequestException) {
      const msg = typeof err.message === 'string' ? err.message : '';
      if (msg.startsWith('Prompt "') && msg.includes('não configurado')) {
        return 'ai_prompt_not_configured';
      }
    }
    return null;
  }

  private async executeAction(workflow: any, event: LeadEvent): Promise<Record<string, unknown>> {
    const config = workflow.actionConfig as Record<string, unknown>;

    switch (workflow.actionType) {
      case 'create_task': {
        const dueDays = Number(config.dueDaysFromNow ?? 1);
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + dueDays);

        const task = await this.prisma.task.create({
          data: {
            orgId: event.orgId,
            leadId: event.leadId,
            createdBy: null,
            title: String(config.title ?? 'Tarefa automática'),
            dueDate,
          },
        });

        await this.prisma.activityLog.create({
          data: {
            orgId: event.orgId,
            leadId: event.leadId,
            userId: null,
            type: 'task_created',
            content: `Tarefa "${task.title}" criada por workflow`,
            metadata: { workflowId: workflow.id },
          },
        });

        return { taskId: task.id };
      }

      case 'move_stage': {
        const targetStageId = String(config.targetStageId ?? '');
        const stage = await this.prisma.pipelineStage.findUnique({
          where: { id: targetStageId },
          select: { orgId: true },
        });
        if (!stage || stage.orgId !== event.orgId) {
          throw new Error(`targetStageId ${targetStageId} does not belong to org ${event.orgId}`);
        }
        await this.prisma.lead.update({
          where: { id: event.leadId },
          data: { pipelineStageId: targetStageId },
        });
        await this.prisma.activityLog.create({
          data: {
            orgId: event.orgId,
            leadId: event.leadId,
            userId: null,
            type: 'stage_changed',
            content: `Estágio alterado por workflow`,
            metadata: { workflowId: workflow.id, targetStageId },
          },
        });
        return { targetStageId };
      }

      case 'update_status': {
        const targetStatus = String(config.targetStatus ?? 'contacted');
        await this.prisma.lead.update({
          where: { id: event.leadId },
          data: { status: targetStatus },
        });
        await this.prisma.activityLog.create({
          data: {
            orgId: event.orgId,
            leadId: event.leadId,
            userId: null,
            type: 'stage_changed',
            content: `Status alterado para "${targetStatus}" por workflow`,
            metadata: { workflowId: workflow.id, targetStatus },
          },
        });
        return { targetStatus };
      }

      case 'ai_classify':
      case 'ai_respond':
      case 'ai_follow_up': {
        const result = await this.aiActionsService.execute(
          workflow.actionType as AiActionType,
          event.leadId,
          event.orgId,
          `workflow:${workflow.id}`,
        );
        if (result.status === 'failed') {
          throw new Error(result.errorMessage ?? 'AI action failed');
        }
        return result.result;
      }

      default:
        throw new Error(`Unknown actionType: ${workflow.actionType}`);
    }
  }
}
