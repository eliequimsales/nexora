'use client';

import { useQuery } from '@tanstack/react-query';
import { auditLogsApi } from '@/lib/api/audit-logs.api';
import type { AuditLogsParams } from '@/lib/api/audit-logs.api';

export function useAuditLogs(params?: AuditLogsParams) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => auditLogsApi.list(params).then((r) => r.data),
    staleTime: 30_000,
  });
}
