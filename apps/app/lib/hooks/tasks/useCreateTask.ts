'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/lib/api/tasks.api';
import { useToast } from '@/lib/providers/ToastProvider';
import { TASKS_QUERY_KEY } from './useTasksQuery';
import type { CreateTaskPayload } from '@/types';

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload: CreateTaskPayload) => tasksApi.create(payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
      toast({ variant: 'success', title: 'Tarefa criada' });
    },
    onError: () => {
      toast({ variant: 'error', title: 'Erro ao criar tarefa' });
    },
  });
}
