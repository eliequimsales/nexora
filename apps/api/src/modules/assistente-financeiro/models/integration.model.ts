/**
 * AssisteFinanceiroIntegration Model
 *
 * Manages CRM and communication channel integrations for the Assistente Financeiro module.
 * Stores encrypted tokens and sync status.
 */

import type {
  AssisteFinanceiroIntegration as PrismaAssisteFinanceiroIntegration,
} from '@prisma/client';

export type IntegrationType = 'pipedrive' | 'email' | 'whatsapp';

export interface AssisteFinanceiroIntegration
  extends PrismaAssisteFinanceiroIntegration {}

/**
 * Integration sync status
 */
export enum SyncStatus {
  IDLE = 'idle',
  SYNCING = 'syncing',
  SUCCESS = 'success',
  ERROR = 'error',
}

/**
 * Integration type configuration
 */
export const INTEGRATION_CONFIG = {
  pipedrive: {
    label: 'Pipedrive',
    category: 'crm',
    requiresAuth: true,
    supportedData: ['customers', 'deals', 'activities'],
    syncIntervalMinutes: 360, // 6 hours
  },
  email: {
    label: 'Email (SendGrid)',
    category: 'communication',
    requiresAuth: true,
    supportedData: ['send', 'track'],
    syncIntervalMinutes: 0, // Real-time
  },
  whatsapp: {
    label: 'WhatsApp Business API',
    category: 'communication',
    requiresAuth: true,
    supportedData: ['send', 'receive'],
    syncIntervalMinutes: 0, // Real-time
  },
} as const;

/**
 * Check if integration is in a valid state for operations
 */
export function isIntegrationReady(integration: AssisteFinanceiroIntegration): boolean {
  return (
    integration.isActive &&
    integration.syncStatus !== 'error' &&
    Boolean(integration.accessToken)
  );
}

/**
 * Check if enough time has passed since last sync
 */
export function shouldSync(
  integration: AssisteFinanceiroIntegration,
  type: IntegrationType,
): boolean {
  const config = INTEGRATION_CONFIG[type];
  if (config.syncIntervalMinutes === 0) return true; // Real-time integrations

  if (!integration.lastSyncAt) return true; // Never synced

  const minutesSinceSync = Math.floor(
    (Date.now() - integration.lastSyncAt.getTime()) / (1000 * 60),
  );

  return minutesSinceSync >= config.syncIntervalMinutes;
}
