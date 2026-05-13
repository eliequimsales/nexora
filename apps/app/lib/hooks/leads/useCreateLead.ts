'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/lib/api/leads.api';
import { useToast } from '@/lib/providers/ToastProvider';
import type { CreateLeadPayload } from '@/types';

export function useCreateLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload: CreateLeadPayload) => leadsApi.create(payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ variant: 'success', title: 'Lead criado' });
    },
    onError: () => {
      toast({ variant: 'error', title: 'Erro ao criar lead', description: 'Tente novamente' });
    },
  });
}
