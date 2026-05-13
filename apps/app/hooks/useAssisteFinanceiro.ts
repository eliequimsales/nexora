'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi, assistenteFinanceiroApi, type DashboardDataResponse, type ChurnedCustomerResponse } from '@/lib/api/dashboard.api';

const STALE_TIME_MS = 60_000; // 1 minute
const REFETCH_INTERVAL_MS = 120_000; // 2 minutes

export function useDashboardActivity() {
  return useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => dashboardApi.activity().then((r) => r.data),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

// Assistente Financeiro hook

export function useAssisteFinanceiro(subscriptionId: string) {
  const dashboardQuery = useQuery({
    queryKey: ['assistente-financeiro', 'dashboard', subscriptionId],
    queryFn: () => assistenteFinanceiroApi.dashboard(subscriptionId).then((r) => r.data),
    enabled: !!subscriptionId,
    staleTime: STALE_TIME_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  const churnedQuery = useQuery({
    queryKey: ['assistente-financeiro', 'churned', subscriptionId],
    queryFn: () => assistenteFinanceiroApi.churnedCustomers(subscriptionId).then((r) => r.data),
    enabled: !!subscriptionId,
    staleTime: STALE_TIME_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  return {
    dashboard: dashboardQuery.data,
    churned: churnedQuery.data ?? [],
    loading: dashboardQuery.isLoading || churnedQuery.isLoading,
    error: dashboardQuery.error || churnedQuery.error,
  };
}
