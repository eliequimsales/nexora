'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { BillingSummary } from '@/types';

/**
 * Hook para monitorar status do trial.
 * Retorna informações de plano, data de término, e se o trial expirou.
 */
export function useTrialStatus() {
  const { data, isLoading } = useQuery<BillingSummary>({
    queryKey: ['billing', 'summary'],
    queryFn: async () => {
      const response = await apiClient.get<BillingSummary>('/billing/summary');
      return response.data;
    },
    staleTime: 60_000, // 1 minuto
  });

  const isTrialing = data?.plan === 'free' && data?.status === 'trialing';
  const currentPeriodEnd = data?.currentPeriodEnd ? new Date(data.currentPeriodEnd) : null;
  const now = new Date();
  const trialExpired = isTrialing && currentPeriodEnd && currentPeriodEnd <= now;
  const daysLeft = currentPeriodEnd
    ? Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    isLoading,
    plan: data?.plan ?? null,
    status: data?.status ?? null,
    isTrialing,
    trialExpired,
    daysLeft: Math.max(0, daysLeft),
    currentPeriodEnd,
    limits: data?.limits,
  };
}
