import { Controller, Get } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RequirePermission } from '../common/rbac/permissions';
import { QUEUE_NAMES } from '@nexora/shared';

@Controller('admin')
export class QueueStatsController {
  constructor(
    @InjectQueue(QUEUE_NAMES.WORKFLOWS) private readonly workflowsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WEBHOOKS) private readonly webhooksQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SCHEDULED_JOBS) private readonly scheduledQueue: Queue,
  ) {}

  @Get('queue-stats')
  @RequirePermission('org:update')
  async getQueueStats() {
    const [wf, wh, sj] = await Promise.all([
      this.workflowsQueue.getJobCounts('waiting', 'delayed', 'failed'),
      this.webhooksQueue.getJobCounts('waiting', 'delayed', 'failed'),
      this.scheduledQueue.getJobCounts('waiting', 'delayed', 'failed'),
    ]);

    return {
      workflows: wf,
      webhooks: wh,
      scheduledJobs: sj,
      totalWaiting: (wf.waiting ?? 0) + (wh.waiting ?? 0) + (sj.waiting ?? 0),
      totalDelayed: (wf.delayed ?? 0) + (wh.delayed ?? 0) + (sj.delayed ?? 0),
      totalFailed: (wf.failed ?? 0) + (wh.failed ?? 0) + (sj.failed ?? 0),
    };
  }
}
