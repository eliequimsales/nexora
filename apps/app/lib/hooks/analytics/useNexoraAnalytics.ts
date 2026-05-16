'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { NexoraAnalyticsDto } from '@/types';

/**
 * Hook para carregar analytics completa da Nexora.
 * Inclui KPIs, tendências, estatísticas de canal e insights.
 */
export function useNexoraAnalytics() {
  const { data, isLoading, error } = useQuery<NexoraAnalyticsDto>({
    queryKey: ['dashboard', 'nexora-analytics'],
    queryFn: async () => {
      const response = await apiClient.get<NexoraAnalyticsDto>('/dashboard/nexora-analytics');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchInterval: 30 * 1000, // refetch a cada 30s
  });

  return {
    data,
    isLoading,
    error,
  };
}
