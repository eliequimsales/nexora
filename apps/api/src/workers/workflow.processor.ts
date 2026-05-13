import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { WorkflowEngine } from '../modules/workflows/workflow.engine';
import { JOB_NAMES, QUEUE_NAMES } from '@reshit/shared';
import type { LeadEvent } from '../modules/workflows/workflow.engine';

@Processor(QUEUE_NAMES.WORKFLOWS)
export class WorkflowProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowProcessor.name);

  constructor(private readonly workflowEngine: WorkflowEngine) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== JOB_NAMES.WORKFLOW_TRIGGER) return;

    const { triggerType, event } = job.data as { triggerType: string; event: LeadEvent };
    this.logger.log(`Processing workflow trigger: ${triggerType} for lead ${event.leadId}`);

    await this.workflowEngine.processTrigger(triggerType, event);
  }
}
