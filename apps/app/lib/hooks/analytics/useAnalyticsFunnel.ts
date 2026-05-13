'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api/analytics.api';

export function useAnalyticsFunnel() {
  return useQuery({
    queryKey: ['analytics', 'funnel'],
    queryFn: () => analyticsApi.getFunnel().then((r) => r.data),
    staleTime: 60_000,
  });
}
