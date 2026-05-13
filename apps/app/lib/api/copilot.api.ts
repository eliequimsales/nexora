import { apiClient } from './client';
import type { CopilotSuggestion } from '@/types';

export const copilotApi = {
  suggestions: () => apiClient.get<CopilotSuggestion[]>('/copilot/suggestions'),
  ask: (leadId: string, question: string) =>
    apiClient.post<{ answer: string }>('/copilot/ask', { leadId, question }),
};
