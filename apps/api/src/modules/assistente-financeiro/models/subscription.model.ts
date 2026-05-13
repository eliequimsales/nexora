/**
 * AssisteFinanceiroSubscription Model
 *
 * Represents an organization's subscription to the Assistente Financeiro module.
 * Tracks tier, trial period, and usage limits.
 */

import type {
  AssisteFinanceiroSubscription as PrismaAssisteFinanceiroSubscription,
} from '@prisma/client';

export type AssisteFinanceiroSubscriptionTier = 'starter' | 'pro' | 'enterprise';
export type AssisteFinanceiroSubscriptionStatus = 'active' | 'trial' | 'inactive';

export interface AssisteFinanceiroSubscription
  extends PrismaAssisteFinanceiroSubscription {}

/**
 * Subscription tier limits
 */
export const SUBSCRIPTION_LIMITS = {
  starter: {
    maxCustomers: 50,
    maxIntegrations: 1,
    maxUsers: 1,
    aiAutomatic: false,
    analyticsLevel: 'basic',
  },
  pro: {
    maxCustomers: 500,
    maxIntegrations: 3,
    maxUsers: 3,
    aiAutomatic: true,
    analyticsLevel: 'complete',
  },
  enterprise: {
    maxCustomers: Infinity,
    maxIntegrations: Infinity,
    maxUsers: Infinity,
    aiAutomatic: true,
    analyticsLevel: 'custom',
  },
} as const;

/**
 * Trial configuration
 */
export const TRIAL_CONFIG = {
  daysValid: 14,
  maxRecoveryActionsBeforePaidRequired: 3,
} as const;
