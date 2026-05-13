import { apiClient } from './client';
import type {
  WorkflowWithStats,
  Workflow,
  WorkflowExecution,
  CreateWorkflowPayload,
  UpdateWorkflowPayload,
} from '@/types';
import type { PaginatedResult } from '@/types';

export const workflowsApi = {
  list: () => apiClient.get<WorkflowWithStats[]>('/workflows'),
  get: (id: string) => apiClient.get<Workflow>(`/workflows/${id}`),
  create: (payload: CreateWorkflowPayload) => apiClient.post<Workflow>('/workflows', payload),
  update: (id: string, payload: UpdateWorkflowPayload) =>
    apiClient.patch<Workflow>(`/workflows/${id}`, payload),
  remove: (id: string) => apiClient.delete(`/workflows/${id}`),
  executions: (id: string, page = 1) =>
    apiClient.get<PaginatedResult<WorkflowExecution>>(`/workflows/${id}/executions`, {
      params: { page },
    }),
};
