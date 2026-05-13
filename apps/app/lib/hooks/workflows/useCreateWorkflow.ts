'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowsApi } from '@/lib/api/workflows.api';
import { useToast } from '@/lib/providers/ToastProvider';
import { WORKFLOWS_QUERY_KEY } from './useWorkflowsQuery';
import type { CreateWorkflowPayload } from '@/types';

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload: CreateWorkflowPayload) =>
      workflowsApi.create(payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOWS_QUERY_KEY });
      toast({ variant: 'success', title: 'Workflow criado' });
    },
    onError: () => {
      toast({ variant: 'error', title: 'Erro ao criar workflow' });
    },
  });
}
