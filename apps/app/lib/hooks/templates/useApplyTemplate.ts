'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { templatesApi } from '@/lib/api/templates.api';
import { useToast } from '@/lib/providers/ToastProvider';

export function useApplyTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (templateId: string) =>
      templatesApi.apply({ templateId }).then((r) => r.data),
    onSuccess: () => {
      // Invalidate pipeline, workflows, and org — all are affected by apply
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['org'] });
      toast({ variant: 'success', title: 'Template aplicado com sucesso' });
    },
    onError: () => {
      toast({ variant: 'error', title: 'Erro ao aplicar template' });
    },
  });
}
