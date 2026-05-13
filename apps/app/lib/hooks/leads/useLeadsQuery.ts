'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { leadsApi } from '@/lib/api/leads.api';
import type { ListLeadsParams } from '@/types';

export function useLeadsQuery(params?: ListLeadsParams) {
  return useQuery({
    queryKey: ['leads', params ?? {}],
    queryFn: () => leadsApi.list(params).then((r) => r.data),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}
