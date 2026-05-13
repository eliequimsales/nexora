import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

/**
 * AIMetricsService
 *
 * Calculates AI performance metrics based on message suggestions and feedback.
 * Provides success rate, accuracy score, and consolidated metrics per subscription.
 *
 * The full DB-backed implementation (querying messageSuggestion and messageFeedback)
 * is scheduled for Task 8. For now we expose deterministic helpers that can be
 * unit tested and a `getMetrics` entrypoint already integrated with the controller.
 */
@Injectable()
export class AIMetricsService {
  private readonly logger = new Logger(AIMetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate success rate (percentage of successful responses).
   *
   * @param successfulResponses - Number of customers who responded
   * @param totalAttempts - Total number of messages sent
   * @returns Success rate as integer between 0 and 100
   */
  calculateSuccessRate(successfulResponses: number, totalAttempts: number): number {
    if (totalAttempts === 0) return 0;
    return Math.round((successfulResponses / totalAttempts) * 100);
  }

  /**
   * Calculate accuracy score based on confidence predictions vs actual results.
   *
   * High confidence + responded  => high accuracy
   * High confidence + no response => low accuracy
   *
   * Placeholder for Task 8 (DB integration). Will query message_suggestions and
   * message_feedback to compute accuracy.
   *
   * @param subscriptionId - The subscription ID
   * @returns Accuracy score (0-100)
   */
  async calculateAccuracyScore(subscriptionId: string): Promise<number> {
    this.logger.debug(`calculateAccuracyScore called for subscription ${subscriptionId}`);
    return 50;
  }

  /**
   * Get comprehensive AI metrics for a subscription.
   *
   * @param subscriptionId - The subscription ID
   * @returns Complete metrics object including accuracy score and success rate
   */
  async getMetrics(subscriptionId: string): Promise<{
    subscriptionId: string;
    customersAnalyzed: number;
    totalSuggestions: number;
    successfulSuggestions: number;
    accuracyScore: number;
    successRate: number;
  }> {
    const accuracyScore = await this.calculateAccuracyScore(subscriptionId);

    return {
      subscriptionId,
      customersAnalyzed: 0,
      totalSuggestions: 0,
      successfulSuggestions: 0,
      accuracyScore,
      successRate: 0,
    };
  }
}
