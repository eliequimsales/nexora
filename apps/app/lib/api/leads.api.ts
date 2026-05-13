import { apiClient } from './client';
import type { Lead, CreateLeadPayload, UpdateLeadPayload, ListLeadsParams } from '@/types';
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
};
