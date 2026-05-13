'use client';

import { useQuery } from '@tanstack/react-query';
import { proposalsApi } from '@/lib/api/proposals.api';
import type { ListProposalsParams } from '@/types';

export const PROPOSALS_QUERY_KEY = ['proposals'] as const;

export function useProposalsQuery(params?: ListProposalsParams) {
  return useQuery({
    queryKey: [...PROPOSALS_QUERY_KEY, params],
    queryFn: () => proposalsApi.list(params).then((r) => r.data),
    staleTime: 30_000,
  });
}
