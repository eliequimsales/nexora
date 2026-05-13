'use client';

import { useQuery } from '@tanstack/react-query';
import { integrationsApi } from '@/lib/api/integrations.api';

export function useConfigs() {
  return useQuery({
    queryKey: ['integrations', 'configs'],
    queryFn: () => integrationsApi.getConfigs().then((r) => r.data),
    staleTime: 60_000,
  });
}
