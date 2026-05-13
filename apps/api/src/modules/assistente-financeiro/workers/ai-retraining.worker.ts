import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { AIMetricsService } from '../services/ai-metrics.service';

/**
 * AIRetrainingWorker
 *
 * Periodically retrains AI models based on collected feedback.
 * Runs weekly to update message generation accuracy and patterns.
 *
 * Future enhancements (Task 8 onwards):
 * - Analyze successful vs unsuccessful messages
 * - Extract patterns (best times, channels, messaging styles)
 * - Update Claude prompt templates
 * - Store learned patterns in ai_learnings table
 */
@Injectable()
export class AIRetrainingWorker {
  private readonly logger = new Logger(AIRetrainingWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiMetricsService: AIMetricsService,
  ) {}

  /**
   * Run retraining every Monday at midnight UTC.
   * Cron: 0 0 * * 1 (Monday at 00:00 UTC).
   *
   * Iterates over all active subscriptions and retrains each one
   * individually so a single failure does not abort the whole batch.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async retrainAll(): Promise<void> {
    this.logger.log('Starting weekly AI retraining for all active subscriptions...');

    try {
      // TODO: Replace with actual subscription query in Task 8
      // const subscriptions = await this.prisma.assisteFinanceiroSubscription.findMany({
      //   where: { status: 'active' },
      // });

      const subscriptions: { id: string }[] = []; // Placeholder

      let successCount = 0;
      let errorCount = 0;

      for (const subscription of subscriptions) {
        try {
          await this.retrainSubscription(subscription.id);
          successCount++;
        } catch (error) {
          this.logger.error(
            `Error retraining subscription ${subscription.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          errorCount++;
        }
      }

      this.logger.log(
        `Weekly retraining completed: ${successCount} successful, ${errorCount} errors`,
      );
    } catch (error) {
      this.logger.error(
        `Critical error in retraining worker: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Retrain a specific subscription using its feedback data.
   *
   * @param subscriptionId - The subscription to retrain
   */
  async retrainSubscription(subscriptionId: string): Promise<void> {
    this.logger.log(`Retraining subscription ${subscriptionId}...`);

    // Get current metrics for this subscription
    const metrics = await this.aiMetricsService.getMetrics(subscriptionId);

    this.logger.log(
      `Subscription ${subscriptionId} metrics - Accuracy: ${metrics.accuracyScore}%, Success Rate: ${metrics.successRate}%`,
    );

    // TODO: Implement actual retraining logic in Task 8+
    // 1. Query message_suggestions + message_feedback from last 7 days
    // 2. Analyze patterns (success by channel, time, confidence)
    // 3. Update prompt templates or stored learnings
    // 4. Update ai_metrics with new accuracy/success rate
  }

  /**
   * Manual trigger for testing or on-demand retraining.
   *
   * @param subscriptionId - The subscription to retrain immediately
   */
  async retrainNow(subscriptionId: string): Promise<void> {
    await this.retrainSubscription(subscriptionId);
  }
}

/*
MESSAGE-DELIVERY.SERVICE.TS SOURCE (for extraction to services/message-delivery.service.ts):

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../database/prisma.service';
import { ZapiWhatsappProvider } from '../providers/zapi-whatsapp.provider';
import { ResendEmailProvider } from '../providers/resend-email.provider';
import { DeliveryRateLimiterService } from './delivery-rate-limiter.service';
import type { MessageDeliveryProvider, DeliveryChannel } from '../providers/message-delivery-provider.interface';

export interface SendArgs {
  messageSuggestionId: string;
  channel: DeliveryChannel;
  recipient: string;
  subject?: string;
  orgId: string;
}

export interface SendResult {
  success: boolean;
  deliveryId?: string;
  externalId?: string;
  status?: string;
  error?: string;
  retryAfterSec?: number;
}

@Injectable()
export class MessageDeliveryService {
  private readonly logger = new Logger(MessageDeliveryService.name);
  private readonly providers: Record<DeliveryChannel, MessageDeliveryProvider>;
  private readonly rateLimitMax = 60;
  private readonly rateLimitWindowSec = 3600;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: ZapiWhatsappProvider,
    private readonly email: ResendEmailProvider,
    private readonly limiter: DeliveryRateLimiterService,
    @InjectQueue('message-delivery') private readonly queue: Queue,
  ) {
    this.providers = { whatsapp: this.whatsapp, email: this.email };
  }

  async send(args: SendArgs): Promise<SendResult> {
    const limit = await this.limiter.checkLimit(args.orgId, args.channel, this.rateLimitMax, this.rateLimitWindowSec);
    if (!limit.allowed) {
      return { success: false, error: 'rate_limit_exceeded', retryAfterSec: limit.retryAfterSec };
    }

    const suggestion = await this.prisma.assisteFinanceiroMessageSuggestion.findUnique({
      where: { id: args.messageSuggestionId },
    });
    if (!suggestion) {
      throw new NotFoundException(\`MessageSuggestion \${args.messageSuggestionId} not found\`);
    }

    const delivery = await this.prisma.assisteFinanceiroMessageDelivery.create({
      data: {
        messageSuggestionId: args.messageSuggestionId,
        channel: args.channel,
        recipient: args.recipient,
        status: 'pending',
        attemptCount: 1,
        lastAttemptAt: new Date(),
      },
    });

    const provider = this.providers[args.channel];
    const result = await provider.send({
      recipient: args.recipient,
      message: suggestion.personalizedMessage,
      subject: args.subject,
    });

    await this.prisma.assisteFinanceiroMessageDelivery.update({
      where: { id: delivery.id },
      data: {
        externalId: result.externalId,
        status: result.status,
        errorMessage: result.error,
      },
    });

    if (!result.success && result.retryable) {
      await this.queue.add(
        'retry',
        { deliveryId: delivery.id, args },
        { attempts: 3, backoff: { type: 'exponential', delay: 30000 } },
      );
    }

    return {
      success: result.success,
      deliveryId: delivery.id,
      externalId: result.externalId,
      status: result.status,
      error: result.error,
    };
  }

  async retry(deliveryId: string, args: SendArgs): Promise<SendResult> {
    const delivery = await this.prisma.assisteFinanceiroMessageDelivery.findFirst({
      where: { id: deliveryId },
    });
    if (!delivery) throw new NotFoundException(\`Delivery \${deliveryId} not found\`);

    const suggestion = await this.prisma.assisteFinanceiroMessageSuggestion.findUnique({
      where: { id: args.messageSuggestionId },
    });
    if (!suggestion) throw new NotFoundException('MessageSuggestion not found');

    const provider = this.providers[args.channel];
    const result = await provider.send({
      recipient: args.recipient,
      message: suggestion.personalizedMessage,
      subject: args.subject,
    });

    await this.prisma.assisteFinanceiroMessageDelivery.update({
      where: { id: deliveryId },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        status: result.status,
        externalId: result.externalId ?? delivery.externalId,
        errorMessage: result.error,
      },
    });

    return {
      success: result.success,
      deliveryId,
      externalId: result.externalId,
      status: result.status,
      error: result.error,
    };
  }

  async handleWebhook(channel: DeliveryChannel, payload: unknown): Promise<void> {
    const provider = this.providers[channel];
    const parsed = provider.parseWebhook(payload);
    if (!parsed) {
      this.logger.warn(\`Unrecognized webhook payload for \${channel}\`);
      return;
    }

    const delivery = await this.prisma.assisteFinanceiroMessageDelivery.findFirst({
      where: { externalId: parsed.externalId },
    });
    if (!delivery) {
      this.logger.warn(\`Delivery not found for externalId \${parsed.externalId}\`);
      return;
    }

    const updates: Record<string, unknown> = { status: parsed.status };
    if (parsed.status === 'delivered') updates.deliveredAt = new Date();
    if (parsed.status === 'read') updates.readAt = new Date();

    await this.prisma.assisteFinanceiroMessageDelivery.update({
      where: { id: delivery.id },
      data: updates,
    });
  }
}
*/
