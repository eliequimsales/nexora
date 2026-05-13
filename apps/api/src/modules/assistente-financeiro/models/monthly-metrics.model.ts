/**
 * AssisteFinanceiroMonthlyMetrics Model
 *
 * Snapshot of monthly performance metrics for dashboard display and analytics.
 * Tracks goals, revenue, and recovery rates on a monthly basis.
 */

import type {
  AssisteFinanceiroMonthlyMetrics as PrismaAssisteFinanceiroMonthlyMetrics,
} from '@prisma/client';

export interface AssisteFinanceiroMonthlyMetrics
  extends PrismaAssisteFinanceiroMonthlyMetrics {}

/**
 * Monthly metrics for analytics and reporting
 */
export interface MonthlyMetricsSnapshot {
  monthYear: string; // YYYY-MM
  goalAmount: number;
  revenueActual: number;
  revenueProjected: number;
  customersLost: number;
  customersRecovered: number;
  recoverySuccessRate: number;
}

/**
 * Calculate goal attainment percentage
 */
export function calculateGoalAttainment(
  metrics: AssisteFinanceiroMonthlyMetrics,
): number {
  if (!metrics.goalAmount || metrics.goalAmount.toNumber() === 0) {
    return 0;
  }
  const actual = metrics.revenueActual?.toNumber() || 0;
  const goal = metrics.goalAmount.toNumber();
  return (actual / goal) * 100;
}

/**
 * Calculate goal status and required recovery
 */
export function calculateGoalStatus(
  metrics: AssisteFinanceiroMonthlyMetrics,
): {
  status: 'on_track' | 'at_risk' | 'at_goal' | 'exceeded';
  attainment: number;
  remainingAmount: number;
  requiredRecoveriesEstimate: number;
} {
  const actual = metrics.revenueActual?.toNumber() || 0;
  const goal = metrics.goalAmount?.toNumber() || 0;
  const projected = metrics.revenueProjected?.toNumber() || 0;

  const attainment = goal > 0 ? (actual / goal) * 100 : 0;
  const remainingAmount = Math.max(0, goal - actual);

  // Estimate based on average customer value
  const avgCustomerValue = metrics.customersRecovered
    ? actual / metrics.customersRecovered
    : 0;
  const requiredRecoveriesEstimate =
    avgCustomerValue > 0 ? Math.ceil(remainingAmount / avgCustomerValue) : 0;

  let status: 'on_track' | 'at_risk' | 'at_goal' | 'exceeded';
  if (actual >= goal) {
    status = 'at_goal';
  } else if (projected >= goal) {
    status = 'on_track';
  } else if (projected >= goal * 0.9) {
    status = 'at_risk';
  } else {
    status = 'at_risk';
  }

  if (actual > goal) {
    status = 'exceeded';
  }

  return {
    status,
    attainment,
    remainingAmount,
    requiredRecoveriesEstimate,
  };
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonthYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Parse YYYY-MM format to Date
 */
export function parseMonthYear(monthYear: string): Date {
  const [year, month] = monthYear.split('-');
  return new Date(parseInt(year), parseInt(month) - 1, 1);
}
