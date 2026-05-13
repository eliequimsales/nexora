'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationsApi } from '@/lib/api/integrations.api';

export function useDeleteConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channel: string) => integrationsApi.deleteConfig(channel),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations', 'configs'] }),
  });
}
