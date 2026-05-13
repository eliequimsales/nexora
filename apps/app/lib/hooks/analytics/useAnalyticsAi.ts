'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api/analytics.api';
import type { AnalyticsPeriod } from '@/types';

export function useAnalyticsAi(period: AnalyticsPeriod = '7d') {
  return useQuery({
    queryKey: ['analytics', 'ai', period],
    queryFn: () => analyticsApi.getAiStats({ period }).then((r) => r.data),
    staleTime: 60_000,
  });
}
