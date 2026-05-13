import { apiClient } from './client';
import type { AnalyticsSummary, FunnelStage, ProposalStats, AiStats } from '@/types';

export interface AnalyticsParams {
  period?: string;
  from?: string;
  to?: string;
}

export const analyticsApi = {
  getSummary: (params?: AnalyticsParams) =>
    apiClient.get<AnalyticsSummary>('/analytics/summary', { params }),

  getFunnel: () =>
    apiClient.get<FunnelStage[]>('/analytics/funnel'),

  getProposalStats: (params?: AnalyticsParams) =>
    apiClient.get<ProposalStats>('/analytics/proposals', { params }),

  getAiStats: (params?: AnalyticsParams) =>
    apiClient.get<AiStats>('/analytics/ai', { params }),

  // Server generates summary from DB — client only passes period params
  generateAiSummary: (params?: AnalyticsParams) =>
    apiClient.post<string>('/analytics/ai-summary', undefined, { params }),
};
