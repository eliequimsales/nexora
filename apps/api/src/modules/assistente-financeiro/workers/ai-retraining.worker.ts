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
