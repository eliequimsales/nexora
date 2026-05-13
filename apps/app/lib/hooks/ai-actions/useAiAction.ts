'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aiActionsApi } from '@/lib/api/ai-actions.api';
import { useToast } from '@/lib/providers/ToastProvider';
import type { AiActionType } from '@/types';

const ACTION_LABELS: Record<AiActionType, string> = {
  ai_classify: 'Classificação concluída',
  ai_respond: 'Resposta gerada',
  ai_follow_up: 'Follow-up gerado',
};

const ACTION_FN: Record<AiActionType, (id: string) => Promise<any>> = {
  ai_classify: (id) => aiActionsApi.classify(id).then((r) => r.data),
  ai_respond: (id) => aiActionsApi.respond(id).then((r) => r.data),
  ai_follow_up: (id) => aiActionsApi.followUp(id).then((r) => r.data),
};

export function useAiAction(
  actionType: AiActionType,
  leadId: string,
  { onResult }: { onResult?: (data: import('@/types').AiActionResult) => void } = {},
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: () => ACTION_FN[actionType](leadId),
    onSuccess: (data) => {
      if (data.status === 'failed') {
        toast({ variant: 'error', title: 'Falha na IA', description: data.errorMessage });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ variant: 'success', title: ACTION_LABELS[actionType] });
      onResult?.(data);
    },
    onError: () => {
      toast({ variant: 'error', title: 'Erro ao executar ação de IA' });
    },
  });
}
