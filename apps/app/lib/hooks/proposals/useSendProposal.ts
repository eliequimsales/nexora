'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { proposalsApi } from '@/lib/api/proposals.api';
import { useToast } from '@/lib/providers/ToastProvider';
import { PROPOSALS_QUERY_KEY } from './useProposalsQuery';

export function useSendProposal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => proposalsApi.send(id).then((r) => r.data),
    onSuccess: (proposal) => {
      queryClient.invalidateQueries({ queryKey: PROPOSALS_QUERY_KEY });
      const link = `${window.location.origin}/p/${proposal.token}`;
      navigator.clipboard.writeText(link).catch(() => undefined);
      toast({ variant: 'success', title: 'Proposta enviada — link copiado' });
    },
    onError: () => {
      toast({ variant: 'error', title: 'Erro ao enviar proposta' });
    },
  });
}
