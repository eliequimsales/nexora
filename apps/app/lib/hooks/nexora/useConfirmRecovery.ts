'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

interface ConfirmRecoveryResponse {
  leadId: string;
  recoveredAt: string;
  recoveredValue: number;
}

/**
 * Confirma que um cliente realmente voltou e pagou.
 * Invalida as queries de dashboard + respostas para refletir a nova receita.
 */
export function useConfirmRecovery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { leadId: string; value: number }) => {
      const response = await apiClient.post<ConfirmRecoveryResponse>(
        `/leads/${input.leadId}/confirm-recovery`,
        { value: input.value },
      );
      return response.data;
    },
    onSuccess: () => {
      // Receita recuperada mudou — invalidar dashboard e analytics
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'nexora-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'nexora-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['nexora', 'responses'] });
      queryClient.invalidateQueries({ queryKey: ['leads', 'inactive'] });
    },
  });
}
