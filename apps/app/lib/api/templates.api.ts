import { apiClient } from './client';
import type { Template, ApplyTemplatePayload } from '@/types';
import type { OrgResponse } from '@/types';

export const templatesApi = {
  list: () =>
    apiClient.get<Template[]>('/templates'),

  getById: (id: string) =>
    apiClient.get<Template>(`/templates/${id}`),

  apply: (payload: ApplyTemplatePayload) =>
    apiClient.post<OrgResponse>('/organizations/current/apply-template', payload),
};
