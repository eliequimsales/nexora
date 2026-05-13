'use client';

import { useMutation } from '@tanstack/react-query';
import { copilotApi } from '@/lib/api/copilot.api';

export function useAskCopilot() {
  return useMutation({
    mutationFn: ({ leadId, question }: { leadId: string; question: string }) =>
      copilotApi.ask(leadId, question).then((r) => r.data),
  });
}
