'use client';

import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '@/lib/api/leads.api';

/**
 * Hook for the Nexora recovery screen — lists inactive clients.
 * Defaults to 30 days, refetches every 60s (matches backend "monitora 24/7" claim).
 */
export function useInactiveClientsQuery(days: number = 30) {
  return useQuery({
    queryKey: ['leads', 'inactive', days],
    queryFn: () => leadsApi.inactive(days).then((r) => r.data),
    staleTime: 60_000,
  });
}
