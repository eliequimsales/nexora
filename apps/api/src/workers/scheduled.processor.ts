import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { AiActionsService } from '../modules/ai-actions/ai-actions.service';
import { JOB_NAMES, QUEUE_NAMES } from '@nexora/shared';

const FOLLOW_UP_DAYS = 3;

interface FollowUpExecuteJobData {
  leadId: string;
  orgId: string;
  daysWithoutActivity: number;
}

@Injectable()
@Processor(QUEUE_NAMES.SCHEDULED_JOBS)
export class ScheduledProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduledProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiActionsService: AiActionsService,
    @InjectQueue(QUEUE_NAMES.SCHEDULED_JOBS) private readonly scheduledQueue: Queue,
  ) {
    super();
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async scanLeadsForFollowUp(): Promise<void> {
    this.logger.log('Running daily follow-up scan...');
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - FOLLOW_UP_DAYS);

    const leads = await this.prisma.lead.findMany({
      where: {
        followUpCount: 0,
        createdAt: { lt: cutoff },
        archivedAt: null,
        status: { notIn: ['closed_won', 'closed_lost', 'disqualified'] },
      },
      select: { id: true, orgId: true },
    });

    if (leads.length === 0) {
      this.logger.log('No leads eligible for follow-up');
      return;
    }

    this.logger.log(`Enqueuing follow-up jobs for ${leads.length} leads`);

    await Promise.allSettled(
      leads.map((lead) =>
        this.scheduledQueue.add(
          JOB_NAMES.FOLLOW_UP_EXECUTE,
          { leadId: lead.id, orgId: lead.orgId, daysWithoutActivity: FOLLOW_UP_DAYS },
          { attempts: 2, backoff: { type: 'exponential', delay: 30_000 } },
        ),
      ),
    );
  }

  async process(job: Job): Promise<void> {
    if (job.name !== JOB_NAMES.FOLLOW_UP_EXECUTE) return;

    const { leadId, orgId } = job.data as FollowUpExecuteJobData;
    this.logger.log(`Executing follow-up for lead ${leadId}`);

    const result = await this.aiActionsService.execute(
      'ai_follow_up',
      leadId,
      orgId,
      'scheduler:follow_up',
    );

    if (result.status === 'failed') {
      throw new Error(result.errorMessage ?? 'ai_follow_up failed in scheduler');
    }
  }
}
