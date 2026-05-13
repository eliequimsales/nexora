import { apiClient } from './client';
import type {
  Proposal, PublicProposal, CreateProposalPayload, UpdateProposalPayload, ListProposalsParams,
} from '@/types';
import type { PaginatedResult } from '@/types';

export const proposalsApi = {
  list: (params?: ListProposalsParams) =>
    apiClient.get<PaginatedResult<Proposal>>('/proposals', { params }),

  get: (id: string) =>
    apiClient.get<Proposal>(`/proposals/${id}`),

  create: (payload: CreateProposalPayload) =>
    apiClient.post<Proposal>('/proposals', payload),

  update: (id: string, payload: UpdateProposalPayload) =>
    apiClient.patch<Proposal>(`/proposals/${id}`, payload),

  archive: (id: string) =>
    apiClient.delete(`/proposals/${id}`),

  send: (id: string) =>
    apiClient.post<Proposal>(`/proposals/${id}/send`),

  duplicate: (id: string) =>
    apiClient.post<Proposal>(`/proposals/${id}/duplicate`),

  // Public endpoints (no auth)
  getByToken: (token: string) =>
    apiClient.get<PublicProposal>(`/proposals/p/${token}`),

  accept: (token: string) =>
    apiClient.post(`/proposals/p/${token}/accept`),

  reject: (token: string, reason?: string) =>
    apiClient.post(`/proposals/p/${token}/reject`, { reason }),
};
