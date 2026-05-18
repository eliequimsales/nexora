'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { RecoveryChannel } from '@/types';

/**
 * Registra que o barbeiro enviou a mensagem manualmente (fora do sistema).
 * Tira o cliente da lista de inativos.
 */
export function useMarkSentManually() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      leadId: string;
      channel: RecoveryChannel;
      message: string;
    }) => {
      const response = await apiClient.post<{ success: true; leadId: string }>(
        `/leads/${input.leadId}/mark-sent-manually`,
        { channel: input.channel, message: input.message },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'inactive'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'nexora-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['nexora', 'responses'] });
    },
  });
}
