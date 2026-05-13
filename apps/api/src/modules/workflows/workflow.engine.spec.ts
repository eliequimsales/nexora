import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowEngine } from './workflow.engine';
import { WorkflowsService } from './workflows.service';
import { PrismaService } from '../../database/prisma.service';
import { AiActionsService } from '../ai-actions/ai-actions.service';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@reshit/shared';

const mockWorkflowsService = {
  findActiveByTrigger: jest.fn(),
  logExecution: jest.fn(),
};

const mockPrisma = {
  workflowExecution: { findFirst: jest.fn() },
  pipelineStage: { findUnique: jest.fn() },
  lead: { update: jest.fn() },
  activityLog: { create: jest.fn() },
  user: { findFirst: jest.fn() },
  task: { create: jest.fn() },
};

const mockAiActionsService = { execute: jest.fn() };
const mockQueue = { add: jest.fn() };

const BASE_EVENT = {
  orgId: 'org-1',
  leadId: 'lead-1',
  leadName: 'Test Lead',
  triggeredBy: 'user-1',
  payload: {},
};

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngine,
        { provide: WorkflowsService, useValue: mockWorkflowsService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiActionsService, useValue: mockAiActionsService },
        { provide: getQueueToken(QUEUE_NAMES.WORKFLOWS), useValue: mockQueue },
      ],
    }).compile();

    engine = module.get<WorkflowEngine>(WorkflowEngine);
  });

  describe('move_stage — cross-tenant guard (H10 regression)', () => {
    it('logs failed execution when targetStageId belongs to another tenant', async () => {
      const workflow = {
        id: 'wf-1',
        actionType: 'move_stage',
        triggerConditions: {},
        actionConfig: { targetStageId: 'stage-evil' },
      };

      mockWorkflowsService.findActiveByTrigger.mockResolvedValueOnce([workflow]);
      // no recent execution → not a duplicate
      mockPrisma.workflowExecution.findFirst.mockResolvedValueOnce(null);
      // stage belongs to a different org
      mockPrisma.pipelineStage.findUnique.mockResolvedValueOnce({ orgId: 'org-EVIL' });

      await engine.processTrigger('lead_created', BASE_EVENT);

      expect(mockWorkflowsService.logExecution).toHaveBeenCalledWith(
        'org-1', 'wf-1', 'lead-1', 'user-1',
        'failed',
        expect.any(Object),
        expect.stringContaining('stage-evil'),
      );
      expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    });

    it('logs failed execution when targetStageId does not exist', async () => {
      const workflow = {
        id: 'wf-1',
        actionType: 'move_stage',
        triggerConditions: {},
        actionConfig: { targetStageId: 'stage-ghost' },
      };

      mockWorkflowsService.findActiveByTrigger.mockResolvedValueOnce([workflow]);
      mockPrisma.workflowExecution.findFirst.mockResolvedValueOnce(null);
      mockPrisma.pipelineStage.findUnique.mockResolvedValueOnce(null);

      await engine.processTrigger('lead_created', BASE_EVENT);

      expect(mockWorkflowsService.logExecution).toHaveBeenCalledWith(
        'org-1', 'wf-1', 'lead-1', 'user-1', 'failed',
        expect.any(Object),
        expect.any(String),
      );
    });

    it('executes successfully when targetStageId belongs to the same tenant', async () => {
      const workflow = {
        id: 'wf-1',
        actionType: 'move_stage',
        triggerConditions: {},
        actionConfig: { targetStageId: 'stage-1' },
      };

      mockWorkflowsService.findActiveByTrigger.mockResolvedValueOnce([workflow]);
      mockPrisma.workflowExecution.findFirst.mockResolvedValueOnce(null);
      mockPrisma.pipelineStage.findUnique.mockResolvedValueOnce({ orgId: 'org-1' });
      mockPrisma.lead.update.mockResolvedValueOnce({});
      mockPrisma.activityLog.create.mockResolvedValueOnce({});

      await engine.processTrigger('lead_created', BASE_EVENT);

      expect(mockPrisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: { pipelineStageId: 'stage-1' },
      });
      expect(mockWorkflowsService.logExecution).toHaveBeenCalledWith(
        'org-1', 'wf-1', 'lead-1', 'user-1', 'success', expect.any(Object),
      );
    });
  });

  describe('loop prevention — duplicate execution dedupe (M9)', () => {
    it('skips workflow when a recent execution exists for same lead within dedupe window', async () => {
      const workflow = {
        id: 'wf-1',
        actionType: 'move_stage',
        triggerConditions: {},
        actionConfig: { targetStageId: 'stage-1' },
      };

      mockWorkflowsService.findActiveByTrigger.mockResolvedValueOnce([workflow]);
      // recent execution found → duplicate
      mockPrisma.workflowExecution.findFirst.mockResolvedValueOnce({ id: 'exec-prev' });

      await engine.processTrigger('lead_created', BASE_EVENT);

      expect(mockWorkflowsService.logExecution).toHaveBeenCalledWith(
        'org-1', 'wf-1', 'lead-1', 'user-1',
        'skipped',
        { reason: 'duplicate_recent_execution' },
      );
      expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    });

    it('processes workflow when no recent execution exists', async () => {
      const workflow = {
        id: 'wf-2',
        actionType: 'update_status',
        triggerConditions: {},
        actionConfig: { targetStatus: 'qualified' },
      };

      mockWorkflowsService.findActiveByTrigger.mockResolvedValueOnce([workflow]);
      mockPrisma.workflowExecution.findFirst.mockResolvedValueOnce(null);
      mockPrisma.lead.update.mockResolvedValueOnce({});
      mockPrisma.activityLog.create.mockResolvedValueOnce({});

      await engine.processTrigger('lead_created', BASE_EVENT);

      expect(mockWorkflowsService.logExecution).toHaveBeenCalledWith(
        'org-1', 'wf-2', 'lead-1', 'user-1', 'success', expect.any(Object),
      );
    });
  });

  describe('condition filtering', () => {
    it('skips workflow when lead_status_changed condition does not match', async () => {
      const workflow = {
        id: 'wf-3',
        actionType: 'update_status',
        triggerConditions: { toStatus: 'qualified' },
        actionConfig: { targetStatus: 'contacted' },
      };

      mockWorkflowsService.findActiveByTrigger.mockResolvedValueOnce([workflow]);

      await engine.processTrigger('lead_status_changed', {
        ...BASE_EVENT,
        toStatus: 'disqualified', // does not match condition
      });

      expect(mockWorkflowsService.logExecution).toHaveBeenCalledWith(
        'org-1', 'wf-3', 'lead-1', 'user-1',
        'skipped',
        { reason: 'condition_not_met' },
      );
    });
  });
});
