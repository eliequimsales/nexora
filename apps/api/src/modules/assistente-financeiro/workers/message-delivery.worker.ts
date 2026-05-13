import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MessageDeliveryService, SendArgs } from '../services/message-delivery.service';

interface RetryJobData {
  deliveryId: string;
  args: SendArgs;
}

@Processor('message-delivery')
export class MessageDeliveryWorker extends WorkerHost {
  private readonly logger = new Logger(MessageDeliveryWorker.name);

  constructor(private readonly delivery: MessageDeliveryService) {
    super();
  }

  async process(job: Job<RetryJobData>): Promise<void> {
    this.logger.log(`Processing ${job.name} attempt ${job.attemptsMade + 1} for delivery ${job.data.deliveryId}`);

    if (job.name === 'retry') {
      const result = await this.delivery.retry(job.data.deliveryId, job.data.args);
      if (!result.success) {
        throw new Error(`Retry failed: ${result.error}`);
      }
    }
  }
}
