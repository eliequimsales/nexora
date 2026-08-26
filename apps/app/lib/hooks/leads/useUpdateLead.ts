'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/lib/api/leads.api';
import { useToast } from '@/lib/providers/ToastProvider';
import type { UpdateLeadPayload } from '@/types';

export function useUpdateLead(id: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload: UpdateLeadPayload) => leadsApi.update(id, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ variant: 'success', title: 'Cliente atualizado' });
    },
    onError: () => {
      toast({
        variant: 'error',
        title: 'Não consegui atualizar o cliente',
        description: 'Tente novamente',
      });
    },
  });
}
