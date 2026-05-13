import { apiClient } from './client';

export interface BillingLimits {
  leadsPerMonth: number;
  aiExecPerMonth: number;
  maxUsers: number;
}

export interface BillingUsage {
  leadsThisMonth: number;
  aiExecThisMonth: number;
  usersCount: number;
}

export interface BillingSummary {
  plan: 'starter' | 'pro' | 'business' | null;
  status: string | null;
  currentPeriodEnd: string | null;
  limits: BillingLimits | null;
  usage: BillingUsage;
}

export const billingApi = {
  getSummary: () =>
    apiClient.get<BillingSummary>('/billing/summary'),

  createCheckout: (priceId: string) =>
    apiClient.post<{ url: string }>('/billing/checkout', { priceId }),

  createPortal: () =>
    apiClient.post<{ url: string }>('/billing/portal'),
};
