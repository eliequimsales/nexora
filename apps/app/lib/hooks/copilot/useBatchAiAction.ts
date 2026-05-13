'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { aiActionsApi } from '@/lib/api/ai-actions.api';
import { useToast } from '@/lib/providers/ToastProvider';
import { COPILOT_QUERY_KEY } from './useCopilotSuggestions';
import type { AiActionType } from '@/types';

export type BatchStatus = 'idle' | 'running' | 'done' | 'error';

export interface BatchState {
  status: BatchStatus;
  processed: number;
  total: number;
  failed: number;
}

const ACTION_FN: Record<AiActionType, (id: string) => Promise<unknown>> = {
  ai_classify: (id) => aiActionsApi.classify(id).then((r) => r.data),
  ai_respond: (id) => aiActionsApi.respond(id).then((r) => r.data),
  ai_follow_up: (id) => aiActionsApi.followUp(id).then((r) => r.data),
};

const DEFAULT_CONCURRENCY = 4;

export function useBatchAiAction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [state, setState] = useState<BatchState>({
    status: 'idle',
    processed: 0,
    total: 0,
    failed: 0,
  });

  async function execute(actionType: AiActionType, leadIds: string[], concurrency = DEFAULT_CONCURRENCY) {
    if (leadIds.length === 0) return;

    setState({ status: 'running', processed: 0, total: leadIds.length, failed: 0 });
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < leadIds.length; i += concurrency) {
      const chunk = leadIds.slice(i, i + concurrency);
      const results = await Promise.allSettled(chunk.map((id) => ACTION_FN[actionType](id)));

      for (const result of results) {
        if (result.status === 'rejected') failed++;
      }

      processed += chunk.length;
      setState({ status: 'running', processed, total: leadIds.length, failed });
    }

    await queryClient.invalidateQueries({ queryKey: ['leads'] });
    await queryClient.invalidateQueries({ queryKey: COPILOT_QUERY_KEY });

    setState({ status: 'done', processed: leadIds.length, total: leadIds.length, failed });

    const succeeded = leadIds.length - failed;
    if (failed === 0) {
      toast({ variant: 'success', title: `${succeeded} lead${succeeded > 1 ? 's' : ''} processado${succeeded > 1 ? 's' : ''}` });
    } else {
      toast({ variant: 'error', title: `${succeeded} ok, ${failed} falhou${failed > 1 ? 'ram' : ''}` });
    }
  }

  function reset() {
    setState({ status: 'idle', processed: 0, total: 0, failed: 0 });
  }

  return { execute, reset, ...state };
}
