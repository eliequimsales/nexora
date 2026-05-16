'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

interface ResponseItem {
  id: string;
  leadId: string;
  leadName: string;
  channel: 'whatsapp' | 'email';
  sentAt: string;
  respondedAt?: string;
  responded: boolean;
  message: string;
  response?: string;
  phone?: string;
  email?: string;
}

interface ResponsesData {
  items: ResponseItem[];
  total: number;
  responded: number;
}

/**
 * Hook para carregar respostas de clientes a mensagens de recuperação.
 * Filtra por status (respondido, não respondido) e exibe timeline.
 */
export function useNexoraResponses() {
  const { data, isLoading, error } = useQuery<ResponsesData>({
    queryKey: ['nexora', 'responses'],
    queryFn: async () => {
      const response = await apiClient.get<ResponsesData>('/dashboard/nexora-responses');
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 60 * 1000, // Refetch every 60s to keep data fresh
  });

  return {
    data: data?.items,
    isLoading,
    error,
  };
}
