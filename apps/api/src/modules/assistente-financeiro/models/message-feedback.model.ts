/**
 * AssisteFinanceiroMessageFeedback Model
 *
 * Represents feedback and outcomes from sent message suggestions.
 * This model tracks whether the message was effective:
 * - Did the customer respond?
 * - Did they return (make a purchase)?
 * - How much revenue was recovered?
 *
 * This is the output of the learning loop - it feeds back into
 * improving future message suggestions.
 */

import type {
  AssisteFinanceiroMessageFeedback as PrismaAssisteFinanceiroMessageFeedback,
} from '@nexora/api-prisma';

export interface AssisteFinanceiroMessageFeedback
  extends PrismaAssisteFinanceiroMessageFeedback {}

/**
 * Feedback status enum - the lifecycle of a message feedback
 */
export enum FeedbackStatus {
  PENDING = 'pending', // Waiting for customer response
  RESPONDED = 'responded', // Customer responded
  RETURNED = 'returned', // Customer made a return purchase
  NO_RESPONSE = 'no_response', // Customer did not respond
}

/**
 * Get feedback status based on response and return information
 */
export function getFeedbackStatus(
  customerResponded?: boolean | null,
  customerReturned?: boolean | null
): FeedbackStatus {
  if (customerResponded === null && customerReturned === null) {
    return FeedbackStatus.PENDING;
  }

  if (customerReturned === true) {
    return FeedbackStatus.RETURNED;
  }

  if (customerResponded === true) {
    return FeedbackStatus.RESPONDED;
  }

  if (customerResponded === false && customerReturned === false) {
    return FeedbackStatus.NO_RESPONSE;
  }

  return FeedbackStatus.PENDING;
}

/**
 * Determine if this feedback indicates a successful recovery
 */
export function isSuccessfulRecovery(
  customerReturned?: boolean | null,
  revenueRecovered?: number | null
): boolean {
  if (customerReturned === true && revenueRecovered && revenueRecovered > 0) {
    return true;
  }
  return false;
}

/**
 * Calculate the effectiveness percentage based on feedback
 * Returns a number 0-100
 */
export function calculateMessageEffectiveness(
  customerResponded?: boolean | null,
  customerReturned?: boolean | null
): number {
  if (customerReturned === true) {
    return 100; // Full effectiveness - customer returned
  }

  if (customerResponded === true) {
    return 50; // Partial effectiveness - customer engaged but didn't return
  }

  if (customerResponded === false || customerReturned === false) {
    return 0; // No effectiveness
  }

  return 0; // Unknown state
}
