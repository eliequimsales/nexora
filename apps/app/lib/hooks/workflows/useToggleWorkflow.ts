'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowsApi } from '@/lib/api/workflows.api';
import { WORKFLOWS_QUERY_KEY } from './useWorkflowsQuery';
import type { WorkflowWithStats } from '@/types';

export function useToggleWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      workflowsApi.update(id, { isActive }).then((r) => r.data),

    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: WORKFLOWS_QUERY_KEY });
      const previous = queryClient.getQueryData(WORKFLOWS_QUERY_KEY);
      queryClient.setQueryData(WORKFLOWS_QUERY_KEY, (old: WorkflowWithStats[] | undefined) =>
        old?.map((w) => (w.id === id ? { ...w, isActive } : w)),
      );
      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(WORKFLOWS_QUERY_KEY, context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOWS_QUERY_KEY });
    },
  });
}
