'use client';

import { useQuery } from '@tanstack/react-query';
import { workflowsApi } from '@/lib/api/workflows.api';

export const WORKFLOWS_QUERY_KEY = ['workflows'] as const;

export function useWorkflowsQuery() {
  return useQuery({
    queryKey: WORKFLOWS_QUERY_KEY,
    queryFn: () => workflowsApi.list().then((r) => r.data),
    staleTime: 30_000,
  });
}
