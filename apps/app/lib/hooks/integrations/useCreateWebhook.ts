'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationsApi, type SaveWebhookPayload } from '@/lib/api/integrations.api';

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveWebhookPayload) =>
      integrationsApi.createWebhook(payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations', 'webhooks'] }),
  });
}
