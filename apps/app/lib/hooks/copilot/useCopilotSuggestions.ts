'use client';

import { useQuery } from '@tanstack/react-query';
import { copilotApi } from '@/lib/api/copilot.api';

export const COPILOT_QUERY_KEY = ['copilot', 'suggestions'] as const;

export function useCopilotSuggestions() {
  return useQuery({
    queryKey: COPILOT_QUERY_KEY,
    queryFn: () => copilotApi.suggestions().then((r) => r.data),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
