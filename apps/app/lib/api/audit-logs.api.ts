import { apiClient } from './client';
import type { AuditLogItem } from '@/types';
import type { PaginatedResult } from '@/types';

export interface AuditLogsParams {
  action?: string;
  actorId?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export const auditLogsApi = {
  list: (params?: AuditLogsParams) =>
    apiClient.get<PaginatedResult<AuditLogItem>>('/audit-logs', { params }),
};
