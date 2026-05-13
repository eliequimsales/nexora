'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationsApi, type SaveConfigPayload } from '@/lib/api/integrations.api';

export function useSaveConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveConfigPayload) =>
      integrationsApi.saveConfig(payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations', 'configs'] }),
  });
}
