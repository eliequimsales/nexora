import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { WebhookDispatcherService } from '../modules/integrations/webhook-dispatcher.service';
import { JOB_NAMES, QUEUE_NAMES } from '@reshit/shared';

interface WebhookJobData {
  orgId: string;
  eventType: string;
  data: Record<string, unknown>;
}

@Processor(QUEUE_NAMES.WEBHOOKS)
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private readonly dispatcher: WebhookDispatcherService) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    if (job.name !== JOB_NAMES.WEBHOOK_DISPATCH) return;

    const { orgId, eventType, data } = job.data;
    const webhooks = await this.dispatcher.findActiveWebhooks(orgId, eventType);

    if (webhooks.length === 0) return;

    this.logger.log(`Delivering ${webhooks.length} webhooks for ${eventType} (attempt ${job.attemptsMade + 1})`);

    const results = await Promise.allSettled(
      webhooks.map((wh: { id: string; url: string; signingSecret: string }) =>
        this.dispatcher.deliverOne(orgId, wh, eventType, data, job.attemptsMade),
      ),
    );

    const failed = results.filter(
      (r: PromiseSettledResult<void>): r is PromiseRejectedResult => r.status === 'rejected',
    );
    if (failed.length > 0) {
      const reasons = failed
        .map((r: PromiseRejectedResult) => (r.reason as Error)?.message ?? 'unknown')
        .join('; ');
      throw new Error(`${failed.length}/${results.length} webhook deliveries failed: ${reasons}`);
    }
  }
}
