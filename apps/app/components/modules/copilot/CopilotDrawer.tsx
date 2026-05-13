'use client';

import { useState } from 'react';
import { X, Sparkles, CheckCircle2, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { SuggestionCard } from './SuggestionCard';
import { useCopilotSuggestions, COPILOT_QUERY_KEY } from '@/lib/hooks/copilot/useCopilotSuggestions';
import { useBatchAiAction } from '@/lib/hooks/copilot/useBatchAiAction';
import type { BatchState } from '@/lib/hooks/copilot/useBatchAiAction';
import { useToggleWorkflow } from '@/lib/hooks/workflows/useToggleWorkflow';
import { aiActionsApi } from '@/lib/api/ai-actions.api';
import type { CopilotSuggestionType } from '@/types';

interface CopilotDrawerProps {
  onClose: () => void;
}

type ActionStatus = Pick<BatchState, 'status' | 'processed' | 'total' | 'failed'>;

const IDLE_STATE: ActionStatus = { status: 'idle', processed: 0, total: 0, failed: 0 };

export function CopilotDrawer({ onClose }: CopilotDrawerProps) {
  const queryClient = useQueryClient();
  const { data: suggestions = [], isLoading, isError } = useCopilotSuggestions();
  const batchAction = useBatchAiAction();
  const toggleWorkflow = useToggleWorkflow();

  // Track per-suggestion action state
  const [actionStates, setActionStates] = useState<Partial<Record<string, ActionStatus>>>({});

  function getState(key: string): ActionStatus {
    return actionStates[key] ?? IDLE_STATE;
  }

  function setDone(key: string) {
    setActionStates((prev) => ({ ...prev, [key]: { ...IDLE_STATE, status: 'done' } }));
  }

  async function handleBatch(
    key: string,
    actionType: 'ai_classify' | 'ai_respond' | 'ai_follow_up',
    leadIds: string[],
  ) {
    setActionStates((prev) => ({
      ...prev,
      [key]: { status: 'running', processed: 0, total: leadIds.length, failed: 0 },
    }));

    let failed = 0;
    const fn =
      actionType === 'ai_classify'
        ? aiActionsApi.classify
        : actionType === 'ai_respond'
        ? aiActionsApi.respond
        : aiActionsApi.followUp;

    for (let i = 0; i < leadIds.length; i++) {
      try {
        await fn(leadIds[i]);
      } catch {
        failed++;
      }
      setActionStates((prev) => ({
        ...prev,
        [key]: { status: 'running', processed: i + 1, total: leadIds.length, failed },
      }));
    }

    await queryClient.invalidateQueries({ queryKey: ['leads'] });
    await queryClient.invalidateQueries({ queryKey: COPILOT_QUERY_KEY });
    setDone(key);
  }

  async function handleActivateWorkflow(workflowId: string, key: string) {
    setActionStates((prev) => ({ ...prev, [key]: { ...IDLE_STATE, status: 'running' } }));
    try {
      await toggleWorkflow.mutateAsync({ id: workflowId, isActive: true });
      await queryClient.invalidateQueries({ queryKey: COPILOT_QUERY_KEY });
      setDone(key);
    } catch {
      setActionStates((prev) => ({ ...prev, [key]: { ...IDLE_STATE, status: 'error' } }));
    }
  }

  function getActionConfig(type: CopilotSuggestionType, leadIds: string[], workflowId?: string) {
    const key = workflowId ?? type;
    switch (type) {
      case 'unclassified_leads':
        return {
          key,
          label: 'Classificar todos',
          onAction: () => handleBatch(key, 'ai_classify', leadIds),
        };
      case 'hot_no_response':
        return {
          key,
          label: 'Gerar respostas',
          onAction: () => handleBatch(key, 'ai_respond', leadIds),
        };
      case 'stale_no_followup':
        return {
          key,
          label: 'Enviar follow-up',
          onAction: () => handleBatch(key, 'ai_follow_up', leadIds),
        };
      case 'inactive_workflow':
        return {
          key,
          label: 'Ativar workflow',
          onAction: () => handleActivateWorkflow(workflowId!, key),
        };
      case 'pipeline_stalled':
        return {
          key,
          label: 'Ver no pipeline',
          onAction: () => {
            onClose();
            // Navigation is handled by the parent page via slug routing
            window.dispatchEvent(new CustomEvent('copilot:navigate', { detail: 'pipeline' }));
          },
        };
    }
  }

  const anyRunning = Object.values(actionStates).some((s) => s?.status === 'running');
  const visibleSuggestions = suggestions.filter((s) => {
    const key = s.workflowId ?? s.type;
    return getState(key).status !== 'done';
  });

  return (
    <div className="fixed inset-0 z-40 flex justify-end pointer-events-none">
      {/* Backdrop — subtle, doesn't block the page */}
      <div
        className="absolute inset-0 bg-black/20 pointer-events-auto"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <div className="relative z-10 w-full max-w-sm h-full bg-brand-surface border-l border-brand-border shadow-2xl flex flex-col pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-amber/10 border border-brand-amber/20 flex items-center justify-center">
              <Sparkles size={14} className="text-brand-amber" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Copilot</h2>
              <p className="text-2xs text-text-muted">Sugestões operacionais</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: COPILOT_QUERY_KEY })}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-brand-surface-2 transition-colors"
              title="Atualizar"
            >
              <RefreshCw size={13} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-brand-surface-2 transition-colors"
              aria-label="Fechar"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-brand-border border-l-4 border-l-brand-border p-4 space-y-2">
                  <div className="h-3.5 skeleton w-2/3" />
                  <div className="h-2.5 skeleton w-full" />
                  <div className="h-7 skeleton w-28 mt-3 rounded-lg" />
                </div>
              ))}
            </div>
          )}

          {isError && (
            <p className="text-sm text-status-error text-center py-6">
              Erro ao carregar sugestões.
            </p>
          )}

          {!isLoading && !isError && visibleSuggestions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <CheckCircle2 size={32} className="text-status-success opacity-60" />
              <p className="text-sm font-medium text-text-primary">Operação em dia</p>
              <p className="text-xs text-text-muted">Nenhuma ação pendente no momento.</p>
            </div>
          )}

          {!isLoading &&
            visibleSuggestions.map((suggestion) => {
              const { key, label, onAction } = getActionConfig(
                suggestion.type,
                suggestion.leadIds,
                suggestion.workflowId,
              );
              return (
                <SuggestionCard
                  key={key}
                  suggestion={suggestion}
                  actionLabel={label}
                  actionState={getState(key)}
                  onAction={onAction}
                  disabled={anyRunning}
                />
              );
            })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-brand-border shrink-0">
          <p className="text-2xs text-text-muted text-center">
            Atualizado automaticamente · dados ao vivo
          </p>
        </div>
      </div>
    </div>
  );
}
