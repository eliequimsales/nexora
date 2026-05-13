'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { activityLogsApi } from '@/lib/api/activity-logs.api';
import { useToast } from '@/lib/providers/ToastProvider';

export function useCreateNote(leadId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (content: string) => activityLogsApi.createNote(leadId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-logs', leadId] });
      toast({ variant: 'success', title: 'Nota registrada' });
    },
    onError: () => {
      toast({ variant: 'error', title: 'Erro ao registrar nota' });
    },
  });
}
