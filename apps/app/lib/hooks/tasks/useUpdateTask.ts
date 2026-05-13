'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/lib/api/tasks.api';
import { useToast } from '@/lib/providers/ToastProvider';
import { TASKS_QUERY_KEY } from './useTasksQuery';
import type { UpdateTaskPayload } from '@/types';

export function useUpdateTask(taskId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload: UpdateTaskPayload) =>
      tasksApi.update(taskId, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
    onError: () => {
      toast({ variant: 'error', title: 'Erro ao atualizar tarefa' });
    },
  });
}
