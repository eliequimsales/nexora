/**
 * AssisteFinanceiroCustomer Model
 *
 * Represents a customer synced from an external CRM.
 * Includes churn risk assessment and activity tracking.
 */

import type {
  AssisteFinanceiroCustomer as PrismaAssisteFinanceiroCustomer,
} from '@prisma/client';

export type CrmSource = 'pipedrive' | 'agendor' | 'rd_station';

export interface AssisteFinanceiroCustomer
  extends PrismaAssisteFinanceiroCustomer {}

/**
 * Churn risk assessment levels
 */
export enum ChurnRiskLevel {
  LOW = 'low', // 0-33
  MEDIUM = 'medium', // 34-66
  HIGH = 'high', // 67-100
}

/**
 * Get churn risk level from score (0-100)
 */
export function getChurnRiskLevel(score?: number | null): ChurnRiskLevel {
  if (!score) return ChurnRiskLevel.MEDIUM;
  if (score <= 33) return ChurnRiskLevel.LOW;
  if (score <= 66) return ChurnRiskLevel.MEDIUM;
  return ChurnRiskLevel.HIGH;
}

/**
 * Determine if a customer is considered churned
 * Criteria: inactive for more than 30 days
 */
export function isChurned(lastActivityDate?: Date | null): boolean {
  if (!lastActivityDate) return false;
  const daysSinceActivity = Math.floor(
    (Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  return daysSinceActivity > 30;
}

/**
 * CRM integration source constants
 */
export const CRM_SOURCES = {
  PIPEDRIVE: 'pipedrive',
  AGENDOR: 'agendor',
  RD_STATION: 'rd_station',
} as const;
