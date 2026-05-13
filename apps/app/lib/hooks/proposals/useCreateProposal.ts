'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { proposalsApi } from '@/lib/api/proposals.api';
import { useToast } from '@/lib/providers/ToastProvider';
import { PROPOSALS_QUERY_KEY } from './useProposalsQuery';

export function useCreateProposal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: proposalsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROPOSALS_QUERY_KEY });
      toast({ variant: 'success', title: 'Proposta criada' });
    },
    onError: () => {
      toast({ variant: 'error', title: 'Erro ao criar proposta' });
    },
  });
}
