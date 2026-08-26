/**
 * AssisteFinanceiroRecoveryAction Model
 *
 * Represents an action taken to recover a churned customer.
 * Tracks the message, delivery, response, and outcome.
 */

import type {
  AssisteFinanceiroRecoveryAction as PrismaAssisteFinanceiroRecoveryAction,
} from '@nexora/api-prisma';

export type ActionType = 'email' | 'whatsapp' | 'sms';
export type SentBy = 'ai_automatic' | 'user_approved' | 'user_manual';

export interface AssisteFinanceiroRecoveryAction
  extends PrismaAssisteFinanceiroRecoveryAction {}

/**
 * Recovery action status
 */
export enum RecoveryActionStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RESPONDED = 'responded',
  COMPLETED = 'completed',
}

/**
 * Check if action was successful (customer returned to business)
 */
export function isActionSuccessful(action: AssisteFinanceiroRecoveryAction): boolean {
  return action.customerReturned === true;
}

/**
 * Calculate impact of recovery action
 */
export function calculateRecoveryImpact(
  action: AssisteFinanceiroRecoveryAction,
): {
  success: boolean;
  discountCost: number;
  revenueRecovered: number;
  netImpact: number;
} {
  const revenueRecovered = action.revenueRecovered?.toNumber() || 0;
  const discountCost = action.discountOffered?.toNumber() || 0;
  const netImpact = revenueRecovered - discountCost;

  return {
    success: isActionSuccessful(action),
    discountCost,
    revenueRecovered,
    netImpact,
  };
}

/**
 * Action type configurations
 */
export const ACTION_TYPE_CONFIG = {
  email: {
    label: 'Email',
    costPerAction: 0.01,
    avgResponseTime: 24 * 60 * 60 * 1000, // 24 hours
  },
  whatsapp: {
    label: 'WhatsApp',
    costPerAction: 0.02,
    avgResponseTime: 4 * 60 * 60 * 1000, // 4 hours
  },
  sms: {
    label: 'SMS',
    costPerAction: 0.05,
    avgResponseTime: 2 * 60 * 60 * 1000, // 2 hours
  },
} as const;
