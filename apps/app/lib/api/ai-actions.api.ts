import { apiClient } from './client';
import type { AiActionResult, AiExecution, AiActionType } from '@/types';
import type { PaginatedResult } from '@/types';

export const aiActionsApi = {
  classify: (leadId: string) =>
    apiClient.post<AiActionResult>(`/ai-actions/classify/${leadId}`),
  respond: (leadId: string) =>
    apiClient.post<AiActionResult>(`/ai-actions/respond/${leadId}`),
  followUp: (leadId: string) =>
    apiClient.post<AiActionResult>(`/ai-actions/follow-up/${leadId}`),
  executions: (params?: { page?: number; status?: string; actionType?: string }) =>
    apiClient.get<PaginatedResult<AiExecution>>('/ai-actions/executions', { params }),
  execution: (id: string) =>
    apiClient.get<AiExecution>(`/ai-actions/executions/${id}`),
};
