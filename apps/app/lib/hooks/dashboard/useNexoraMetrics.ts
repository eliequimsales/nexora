'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { NexoraMetricsDto } from '@/types';

/**
 * Hook para buscar métricas de Nexora (recuperação de clientes).
 * Usado pelo dashboard Nexora para mostrar inativos, recuperados, receita.
 */
export function useNexoraMetrics() {
  return useQuery<NexoraMetricsDto>({
    queryKey: ['dashboard', 'nexora-metrics'],
    queryFn: async () => {
      const response = await apiClient.get<NexoraMetricsDto>('/dashboard/nexora-metrics');
      return response.data;
    },
    staleTime: 60_000, // 1 minuto
    refetchInterval: 60_000, // auto-refetch a cada 1 min
  });
}
