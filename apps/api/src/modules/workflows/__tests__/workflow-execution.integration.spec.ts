import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkflowEngine, LeadEvent } from '../workflow.engine';
import { WorkflowsService } from '../workflows.service';
import { PrismaService } from '../../../database/prisma.service';
import { AiActionsService } from '../../ai-actions/ai-actions.service';
import { AuditLogService } from '../../audit-logs/audit-log.service';
import { QUEUE_NAMES, JOB_NAMES } from '@reshit/shared';

/**
 * I2 - Workflow End-to-End Integration Tests
 *
 * Validates the workflow trigger pipeline:
 *   - lead.created event → WorkflowEngine.onLeadCreated → BullMQ enqueue
 *   - Direct processTrigger → executes action and logs execution
 *   - AiExecution recorded via AiActionsService (mock LLM)
 *   - workflow_executions table updated with proper status
 *   - Conditions filter workflows that should not run
 *   - Multi-action: when multiple workflows match same trigger
 *
 * Strategy:
 *   - Real WorkflowEngine + WorkflowsService.
 *   - PrismaService and AiActionsService mocked.
 *   - BullMQ queue mocked — we assert .add() was called (no real worker).
 *   - LLM_PROVIDER=mock is implicit because AiActionsService is fully stubbed.
 */
describe('Workflow Execution Integration (e2e)', () => {
  let engine: WorkflowEngine;
  let workflowsService: WorkflowsService;
  let prismaMock: any;
  let aiActionsMock: any;
  let queueMock: any;
  let auditLogMock: any;

  const BASE_EVENT: LeadEvent = {
    orgId: 'org-int-1',
    leadId: 'lead-int-1',
    leadName: 'Lead Integration',
    triggeredBy: 'user-int-1',
    payload: { source: 'manual' },
  };

  beforeAll(async () => {
    prismaMock = {
      workflow: { findMany: jest.fn(), findUnique: jest.fn() },
      workflowExecution: { findFirst: jest.fn(), create: jest.fn() },
      pipelineStage: { findUnique: jest.fn() },
      lead: { update: jest.fn() },
      activityLog: { create: jest.fn() },
      task: { create: jest.fn() },
      aiExecution: { create: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };

    aiActionsMock = {
      execute: jest.fn(),
    };

    queueMock = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    auditLogMock = {
      record: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngine,
        WorkflowsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AiActionsService, useValue: aiActionsMock },
        { provide: AuditLogService, useValue: auditLogMock },
        { provide: getQueueToken(QUEUE_NAMES.WORKFLOWS), useValue: queueMock },
      ],
    }).compile();

    engine = module.get(WorkflowEngine);
    workflowsService = module.get(WorkflowsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.workflowExecution.create.mockResolvedValue({ id: 'exec-1' });
    prismaMock.workflowExecution.findFirst.mockResolvedValue(null); // no dedupe
  });

  // ── Tests ────────────────────────────────────────────────────────────────

  it('should execute workflow when lead_created event fires', async () => {
    // Enqueue path: @OnEvent('lead.created') → queue.add(WORKFLOW_TRIGGER, ...)
    await engine.onLeadCreated(BASE_EVENT);

    expect(queueMock.add).toHaveBeenCalledWith(JOB_NAMES.WORKFLOW_TRIGGER, {
      triggerType: 'lead_created',
      event: BASE_EVENT,
    });
  });

  it('should create AiExecution with status success using mock LLM (ai_classify action)', async () => {
    const workflow = {
      id: 'wf-classify-1',
      orgId: 'org-int-1',
      actionType: 'ai_classify',
      triggerType: 'lead_created',
      triggerConditions: {},
      actionConfig: {},
      isActive: true,
    };

    prismaMock.workflow.findMany.mockResolvedValueOnce([workflow]);
    aiActionsMock.execute.mockResolvedValueOnce({
      executionId: 'ai-exec-1',
      actionType: 'ai_classify',
      status: 'success',
      result: { classification: 'warm', score: 55 },
    });

    await engine.processTrigger('lead_created', BASE_EVENT);

    expect(aiActionsMock.execute).toHaveBeenCalledWith(
      'ai_classify',
      BASE_EVENT.leadId,
      BASE_EVENT.orgId,
      `workflow:${workflow.id}`,
    );
    // logExecution writes to workflow_executions with status=success
    expect(prismaMock.workflowExecution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: BASE_EVENT.orgId,
        workflowId: workflow.id,
        leadId: BASE_EVENT.leadId,
        status: 'success',
        triggeredBy: BASE_EVENT.triggeredBy,
        result: expect.objectContaining({ classification: 'warm', score: 55 }),
      }),
    });
  });

  it('should record execution result in workflow_executions table', async () => {
    const workflow = {
      id: 'wf-task-1',
      orgId: 'org-int-1',
      actionType: 'create_task',
      triggerType: 'lead_created',
      triggerConditions: {},
      actionConfig: { title: 'Follow up novo lead', dueDaysFromNow: 2 },
      isActive: true,
    };

    prismaMock.workflow.findMany.mockResolvedValueOnce([workflow]);
    prismaMock.task.create.mockResolvedValueOnce({ id: 'task-new-1', title: 'Follow up novo lead' });
    prismaMock.activityLog.create.mockResolvedValueOnce({});

    await engine.processTrigger('lead_created', BASE_EVENT);

    expect(prismaMock.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: BASE_EVENT.orgId,
        leadId: BASE_EVENT.leadId,
        title: 'Follow up novo lead',
      }),
    });
    expect(prismaMock.workflowExecution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: BASE_EVENT.orgId,
        workflowId: workflow.id,
        status: 'success',
        result: expect.objectContaining({ taskId: 'task-new-1' }),
      }),
    });
  });

  it('should skip workflow when trigger condition does not match', async () => {
    const workflow = {
      id: 'wf-cond-1',
      orgId: 'org-int-1',
      actionType: 'update_status',
      triggerType: 'lead_status_changed',
      // Only run when status moves to 'qualified'
      triggerConditions: { toStatus: 'qualified' },
      actionConfig: { targetStatus: 'contacted' },
      isActive: true,
    };

    prismaMock.workflow.findMany.mockResolvedValueOnce([workflow]);

    await engine.processTrigger('lead_status_changed', {
      ...BASE_EVENT,
      toStatus: 'disqualified', // different from required 'qualified'
    });

    // Should write a skipped execution log, not run the action
    expect(prismaMock.workflowExecution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'skipped',
        result: { reason: 'condition_not_met' },
      }),
    });
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
  });

  it('should handle multiple workflows matching the same trigger', async () => {
    const wf1 = {
      id: 'wf-multi-1',
      orgId: 'org-int-1',
      actionType: 'update_status',
      triggerType: 'lead_created',
      triggerConditions: {},
      actionConfig: { targetStatus: 'contacted' },
      isActive: true,
    };
    const wf2 = {
      id: 'wf-multi-2',
      orgId: 'org-int-1',
      actionType: 'create_task',
      triggerType: 'lead_created',
      triggerConditions: {},
      actionConfig: { title: 'Tarefa multi-action' },
      isActive: true,
    };

    prismaMock.workflow.findMany.mockResolvedValueOnce([wf1, wf2]);
    prismaMock.lead.update.mockResolvedValue({});
    prismaMock.task.create.mockResolvedValue({ id: 'task-multi-1', title: 'Tarefa multi-action' });
    prismaMock.activityLog.create.mockResolvedValue({});

    await engine.processTrigger('lead_created', BASE_EVENT);

    // Both workflows executed → 2 execution records
    expect(prismaMock.workflowExecution.create).toHaveBeenCalledTimes(2);
    const calls = prismaMock.workflowExecution.create.mock.calls;
    const workflowIds = calls.map((c: any[]) => c[0].data.workflowId).sort();
    expect(workflowIds).toEqual(['wf-multi-1', 'wf-multi-2']);
  });
});
