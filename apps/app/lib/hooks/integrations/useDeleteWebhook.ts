'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationsApi } from '@/lib/api/integrations.api';

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => integrationsApi.deleteWebhook(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations', 'webhooks'] }),
  });
}
