'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationsApi } from '@/lib/api/integrations.api';
import { useToast } from '@/lib/providers/ToastProvider';

export function useToggleConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ channel, isActive }: { channel: string; isActive: boolean }) =>
      integrationsApi.toggleConfig(channel, isActive),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'configs'] });
      toast({
        variant: 'success',
        title: isActive ? 'Canal ativado' : 'Canal desativado',
      });
    },
    onError: () => {
      toast({ variant: 'error', title: 'Erro ao alterar status do canal' });
    },
  });
}
