'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi, assistenteFinanceiroApi, type DashboardDataResponse, type ChurnedCustomerResponse } from '@/lib/api/dashboard.api';

export function useDashboardActivity() {
  return useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => dashboardApi.activity().then((r) => r.data),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

// Assistente Financeiro hook

export function useAssistenteFinanceiro(subscriptionId: string) {
  const dashboardQuery = useQuery({
    queryKey: ['assistente-financeiro', 'dashboard', subscriptionId],
    queryFn: () => assistenteFinanceiroApi.dashboard(subscriptionId).then((r) => r.data),
    enabled: !!subscriptionId,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const churnedQuery = useQuery({
    queryKey: ['assistente-financeiro', 'churned', subscriptionId],
    queryFn: () => assistenteFinanceiroApi.churnedCustomers(subscriptionId).then((r) => r.data),
    enabled: !!subscriptionId,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  return {
    dashboard: dashboardQuery.data,
    churned: churnedQuery.data ?? [],
    loading: dashboardQuery.isLoading || churnedQuery.isLoading,
    error: dashboardQuery.error || churnedQuery.error,
  };
}
