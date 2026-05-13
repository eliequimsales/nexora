/**
 * AssisteFinanceiroAiMetrics Model
 *
 * Tracks IA performance metrics including accuracy, suggestion count,
 * and learning progress for churn prediction and recovery actions.
 */

import type {
  AssisteFinanceiroAiMetrics as PrismaAssisteFinanceiroAiMetrics,
} from '@prisma/client';

export interface AssisteFinanceiroAiMetrics
  extends PrismaAssisteFinanceiroAiMetrics {}

/**
 * IA performance thresholds
 */
export const AI_METRICS_THRESHOLDS = {
  minAccuracy: 70, // Below 70% triggers retraining
  minSuggestionsForAccuracy: 50, // Need at least 50 suggestions to calculate accuracy
  retrainingFrequencyDays: 7,
  minDataPointsForModel: 20,
} as const;

/**
 * Calculate success rate from metrics
 */
export function calculateSuccessRate(
  metrics: AssisteFinanceiroAiMetrics,
): number {
  if (metrics.totalSuggestions === 0) return 0;
  return (metrics.successfulSuggestions / metrics.totalSuggestions) * 100;
}

/**
 * Determine if model needs retraining
 */
export function needsRetraining(metrics: AssisteFinanceiroAiMetrics): boolean {
  // Retrain if accuracy below threshold
  if (metrics.accuracyScore && metrics.accuracyScore < AI_METRICS_THRESHOLDS.minAccuracy) {
    return true;
  }

  // Retrain if last retraining was more than N days ago
  if (metrics.lastRetrainingAt) {
    const daysSinceRetraining = Math.floor(
      (Date.now() - metrics.lastRetrainingAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysSinceRetraining >= AI_METRICS_THRESHOLDS.retrainingFrequencyDays;
  }

  return true; // Always retrain if never trained
}

/**
 * Model maturity level based on data points
 */
export enum ModelMaturity {
  BOOTSTRAP = 'bootstrap', // < 50 data points
  LEARNING = 'learning', // 50-200 data points
  TRAINED = 'trained', // > 200 data points
}

export function getModelMaturity(metrics: AssisteFinanceiroAiMetrics): ModelMaturity {
  const dataPoints = metrics.customersAnalyzed + metrics.totalSuggestions;

  if (dataPoints < 50) return ModelMaturity.BOOTSTRAP;
  if (dataPoints < 200) return ModelMaturity.LEARNING;
  return ModelMaturity.TRAINED;
}
