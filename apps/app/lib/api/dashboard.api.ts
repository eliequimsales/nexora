import { apiClient } from './client';
import type { DashboardSummary, DashboardActivity } from '@/types';

export const dashboardApi = {
  summary: () => apiClient.get<DashboardSummary>('/dashboard/summary'),
  activity: () => apiClient.get<DashboardActivity>('/dashboard/activity'),
};

// Assistente Financeiro API
export interface DashboardDataResponse {
  goalAmount: number;
  revenueActual: number;
  revenueProjected: number;
  goalAchievementPercent: number;
  churnedCustomers: number;
  recoveredCustomersThisMonth: number;
  recoverySuccessRate: number;
  aiMetrics: {
    customersAnalyzed: number;
    suggestionsGiven: number;
    accuracyScore: number;
  };
}

export interface ChurnedCustomerResponse {
  id: string;
  name: string;
  email: string;
  phone: string;
  revenue: number;
  daysInactive: number;
  recoveryProbability: number;
  suggestedAction: {
    type: 'email' | 'whatsapp';
    message: string;
  };
}

export const assistenteFinanceiroApi = {
  dashboard: (subscriptionId: string) =>
    apiClient.get<DashboardDataResponse>(`/assistente-financeiro/dashboard/${subscriptionId}`),
  churnedCustomers: (subscriptionId: string) =>
    apiClient.get<ChurnedCustomerResponse[]>(`/assistente-financeiro/churned-customers/${subscriptionId}`),
};
