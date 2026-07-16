'use client';

import { useQuery } from '@tanstack/react-query';
import { organizationsApi } from '@/lib/api/organizations.api';

export const ORG_QUERY_KEY = ['org', 'me'] as const;

export function useOrgQuery(enabled = true) {
  return useQuery({
    queryKey: ORG_QUERY_KEY,
    queryFn: () => organizationsApi.me().then((r) => r.data),
    staleTime: 60_000,
    enabled,
  });
}