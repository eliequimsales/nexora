import { apiClient } from './client';
import type { Task, CreateTaskPayload, UpdateTaskPayload, ListTasksParams } from '@/types';
import type { PaginatedResult } from '@/types';

export const tasksApi = {
  list: (params?: ListTasksParams) =>
    apiClient.get<PaginatedResult<Task>>('/tasks', { params }),

  get: (id: string) =>
    apiClient.get<Task>(`/tasks/${id}`),

  create: (payload: CreateTaskPayload) =>
    apiClient.post<Task>('/tasks', payload),

  update: (id: string, payload: UpdateTaskPayload) =>
    apiClient.patch<Task>(`/tasks/${id}`, payload),

  remove: (id: string) =>
    apiClient.delete(`/tasks/${id}`),
};
