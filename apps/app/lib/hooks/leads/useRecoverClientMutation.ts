'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/lib/api/leads.api';
import type { RecoveryChannel, RecoveryResult } from '@/types';

interface RecoverArgs {
  leadId: string;
  channel?: RecoveryChannel;
}

/**
 * Hook que dispara a recuperação de um cliente inativo via IA.
 *
 * Em sucesso invalida a query de inativos para que o cliente saia da lista
 * (o backend bumpa `updatedAt` ao incrementar `followUpCount`).
 */
export function useRecoverClientMutation() {
  const qc = useQueryClient();

  return useMutation<RecoveryResult, Error, RecoverArgs>({
    mutationFn: async ({ leadId, channel }) => {
      const response = await leadsApi.recover(leadId, channel);
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads', 'inactive'] });
    },
  });
}
