'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

interface BatchRecoveryInput {
  leadIds: string[];
  channels: Array<'whatsapp' | 'email'>;
}

interface BatchRecoveryResponse {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
}

/**
 * Hook para enviar mensagens de recuperação em lote para múltiplos clientes.
 */
export function useBatchRecovery() {
  const { mutate, isPending, isSuccess, data, error } = useMutation({
    mutationFn: async (input: BatchRecoveryInput) => {
      const response = await apiClient.post<BatchRecoveryResponse>('/leads/batch-recover', input);
      return response.data;
    },
  });

  return {
    mutate,
    isPending,
    isSuccess,
    selected: data?.sent || 0,
    failed: data?.failed || 0,
    skipped: data?.skipped || 0,
    error,
  };
}
