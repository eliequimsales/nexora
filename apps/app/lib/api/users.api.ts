import { apiClient } from './client';
import type { OrgUser, UpdateUserPayload, UpdateProfilePayload, InviteUserPayload, PaginatedResult } from '@/types';

export interface ListUsersParams {
  page?: number;
  limit?: number;
  status?: 'active' | 'inactive';
}

export const usersApi = {
  me: () => apiClient.get<OrgUser>('/users/me'),

  updateProfile: (data: UpdateProfilePayload) =>
    apiClient.patch<OrgUser>('/users/me', data),

  list: (params?: ListUsersParams) =>
    apiClient.get<PaginatedResult<OrgUser>>('/users', { params }),

  get: (id: string) => apiClient.get<OrgUser>(`/users/${id}`),

  update: (id: string, data: UpdateUserPayload) =>
    apiClient.patch<OrgUser>(`/users/${id}`, data),

  invite: (data: InviteUserPayload) =>
    apiClient.post<{ tempPassword: string }>('/users/invite', data),
};
