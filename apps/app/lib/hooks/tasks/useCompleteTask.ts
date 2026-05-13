'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/lib/api/tasks.api';
import { useToast } from '@/lib/providers/ToastProvider';
import { TASKS_QUERY_KEY } from './useTasksQuery';

export function useCompleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (taskId: string) =>
      tasksApi.update(taskId, { status: 'done' }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
      toast({ variant: 'success', title: 'Tarefa concluída' });
    },
    onError: () => {
      toast({ variant: 'error', title: 'Erro ao concluir tarefa' });
    },
  });
}
