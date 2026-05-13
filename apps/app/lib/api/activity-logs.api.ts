import { apiClient } from './client';
import type { ActivityLogItem } from '@/types';
import type { PaginatedResult } from '@/types';

export const activityLogsApi = {
  list: (params?: { leadId?: string; page?: number; limit?: number }) =>
    apiClient.get<PaginatedResult<ActivityLogItem>>('/activity-logs', { params }),

  createNote: (leadId: string, content: string) =>
    apiClient.post('/activity-logs/notes', { leadId, content }),
};
