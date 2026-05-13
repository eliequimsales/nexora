'use client';

import { useQuery } from '@tanstack/react-query';
import { activityLogsApi } from '@/lib/api/activity-logs.api';

export function useLeadTimeline(leadId: string, enabled = true) {
  return useQuery({
    queryKey: ['activity-logs', 'lead', leadId],
    queryFn: () => activityLogsApi.list({ leadId, limit: 20 }).then((r) => r.data),
    enabled: !!leadId && enabled,
    staleTime: 30_000,
  });
}
