'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api/analytics.api';
import type { AnalyticsPeriod } from '@/types';

export function useAnalyticsProposals(period: AnalyticsPeriod = '7d') {
  return useQuery({
    queryKey: ['analytics', 'proposals', period],
    queryFn: () => analyticsApi.getProposalStats({ period }).then((r) => r.data),
    staleTime: 60_000,
  });
}
