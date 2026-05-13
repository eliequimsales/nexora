'use client';

import { useQuery } from '@tanstack/react-query';
import { tasksApi } from '@/lib/api/tasks.api';
import type { ListTasksParams } from '@/types';

export const TASKS_QUERY_KEY = ['tasks'] as const;

export function useTasksQuery(params?: ListTasksParams) {
  return useQuery({
    queryKey: [...TASKS_QUERY_KEY, params],
    queryFn: () => tasksApi.list(params).then((r) => r.data),
  });
}
