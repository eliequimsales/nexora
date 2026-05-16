import { apiClient } from './client';
import type {
  Lead,
  CreateLeadPayload,
  UpdateLeadPayload,
  ListLeadsParams,
  InactiveClient,
  RecoveryChannel,
  RecoveryResult,
} from '@/types';
import type { PaginatedResult } from '@/types';

export const leadsApi = {
  list: (params?: ListLeadsParams) =>
    apiClient.get<PaginatedResult<Lead>>('/leads', { params }),
  get: (id: string) =>
    apiClient.get<Lead>(`/leads/${id}`),
  create: (payload: CreateLeadPayload) =>
    apiClient.post<Lead>('/leads', payload),
  update: (id: string, payload: UpdateLeadPayload) =>
    apiClient.patch<Lead>(`/leads/${id}`, payload),
  archive: (id: string) =>
    apiClient.delete(`/leads/${id}`),
  /**
   * Fetch clients without activity in the last `days` days.
   * Powers the Nexora "Clientes Inativos" recovery screen.
   */
  inactive: (days: number = 30) =>
    apiClient.get<InactiveClient[]>('/leads/inactive', { params: { days } }),
  /**
   * Triggers an AI-generated recovery message for a lead.
   * Backend chooses the channel automatically when `channel` is omitted.
   */
  recover: (leadId: string, channel?: RecoveryChannel) =>
    apiClient.post<RecoveryResult>(`/leads/${leadId}/recuperar`, { channel }),
};

/**
 * Convenience helper for the Nexora recovery page.
 * Mirrors the legacy signature requested by the product spec.
 */
export function fetchInactiveClients(_slug: string, days: number = 30) {
  return leadsApi.inactive(days);
}
