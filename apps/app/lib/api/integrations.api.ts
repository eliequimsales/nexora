import { apiClient } from './client';
import type { IntegrationConfig, OutboundWebhook, IntegrationLog } from '@/types';
import type { PaginatedResult } from '@/types';

export interface SaveConfigPayload {
  channel: 'whatsapp' | 'email';
  config: Record<string, unknown>;
  isActive?: boolean;
}

export interface SaveWebhookPayload {
  url: string;
  events: string[];
  isActive?: boolean;
}

export interface IntegrationLogsParams {
  channel?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const integrationsApi = {
  // configs
  getConfigs: () => apiClient.get<IntegrationConfig[]>('/integrations/configs'),
  saveConfig: (payload: SaveConfigPayload) =>
    apiClient.post<IntegrationConfig>('/integrations/configs', payload),
  toggleConfig: (channel: string, isActive: boolean) =>
    apiClient.patch<Pick<IntegrationConfig, 'id' | 'channel' | 'isActive' | 'updatedAt'>>(
      `/integrations/configs/${channel}/toggle`,
      { isActive },
    ),
  deleteConfig: (channel: string) =>
    apiClient.delete(`/integrations/configs/${channel}`),
  testChannel: (channel: string) =>
    apiClient.post<{ ok: boolean; error?: string }>(`/integrations/configs/${channel}/test`),

  // webhooks
  getWebhooks: () => apiClient.get<OutboundWebhook[]>('/integrations/webhooks'),
  createWebhook: (payload: SaveWebhookPayload) =>
    apiClient.post<OutboundWebhook>('/integrations/webhooks', payload),
  updateWebhook: (id: string, payload: Partial<SaveWebhookPayload>) =>
    apiClient.patch<OutboundWebhook>(`/integrations/webhooks/${id}`, payload),
  deleteWebhook: (id: string) =>
    apiClient.delete(`/integrations/webhooks/${id}`),

  // logs
  getLogs: (params?: IntegrationLogsParams) =>
    apiClient.get<PaginatedResult<IntegrationLog>>('/integrations/logs', { params }),
};
