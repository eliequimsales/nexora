'use client';

import { useQuery } from '@tanstack/react-query';
import { integrationsApi } from '@/lib/api/integrations.api';

export function useWebhooks() {
  return useQuery({
    queryKey: ['integrations', 'webhooks'],
    queryFn: () => integrationsApi.getWebhooks().then((r) => r.data),
    staleTime: 60_000,
  });
}
