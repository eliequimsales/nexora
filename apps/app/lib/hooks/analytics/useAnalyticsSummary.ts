'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api/analytics.api';
import type { AnalyticsPeriod } from '@/types';

export function useAnalyticsSummary(period: AnalyticsPeriod = '7d') {
  return useQuery({
    queryKey: ['analytics', 'summary', period],
    queryFn: () => analyticsApi.getSummary({ period }).then((r) => r.data),
    staleTime: 60_000,
  });
}
