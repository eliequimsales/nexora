'use client';

import { useQuery } from '@tanstack/react-query';
import { integrationsApi, type IntegrationLogsParams } from '@/lib/api/integrations.api';

export function useIntegrationLogs(params?: IntegrationLogsParams) {
  return useQuery({
    queryKey: ['integrations', 'logs', params],
    queryFn: () => integrationsApi.getLogs(params).then((r) => r.data),
    staleTime: 30_000,
  });
}
