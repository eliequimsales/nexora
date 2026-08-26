/**
 * AssisteFinanceiroMessageSuggestion Model
 *
 * Represents AI-generated message suggestions for customer recovery with confidence scoring.
 * Each suggestion includes the base message template, personalized version, and contextual data.
 */

import type {
  AssisteFinanceiroMessageSuggestion as PrismaAssisteFinanceiroMessageSuggestion,
} from '@nexora/api-prisma';

export interface AssisteFinanceiroMessageSuggestion
  extends PrismaAssisteFinanceiroMessageSuggestion {}

/**
 * Message channel types supported
 */
export enum MessageChannel {
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
}

/**
 * Confidence level thresholds for message suggestions
 */
export const CONFIDENCE_THRESHOLDS = {
  LOW_BOUNDARY: 40,
  MEDIUM_BOUNDARY: 70,
} as const;

/**
 * Context data that can be included with a message suggestion
 * Flexible structure for different use cases and channels
 */
export interface MessageSuggestionContextData {
  daysSinceLastPurchase?: number;
  totalRevenue?: number;
  recoveryProbability?: number;
  lastPurchaseValue?: number;
  channelHistory?: string[];
  [key: string]: unknown;
}

/**
 * Get confidence level display text
 */
export function getConfidenceLevel(confidence: number): 'low' | 'medium' | 'high' {
  if (confidence < CONFIDENCE_THRESHOLDS.LOW_BOUNDARY) return 'low';
  if (confidence < CONFIDENCE_THRESHOLDS.MEDIUM_BOUNDARY) return 'medium';
  return 'high';
}

/**
 * Validate confidence score is within valid range
 */
export function isValidConfidence(confidence: number): boolean {
  return confidence >= 0 && confidence <= 100;
}
