'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api/dashboard.api';

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardApi.summary().then((r) => r.data),
    staleTime: 30_000,
    refetchInterval: 60_000, // auto-refresh every minute
  });
}
