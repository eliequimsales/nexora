'use client';

import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { CopilotSuggestion } from '@/types';
import type { BatchState } from '@/lib/hooks/copilot/useBatchAiAction';

const PRIORITY_BORDER: Record<1 | 2 | 3, string> = {
  1: 'border-l-brand-amber',
  2: 'border-l-status-warning',
  3: 'border-l-brand-border-2',
};

interface SuggestionCardProps {
  suggestion: CopilotSuggestion;
  actionLabel: string;
  actionState: BatchState | { status: 'idle' | 'running' | 'done' | 'error'; processed?: number; total?: number };
  onAction: () => void;
  disabled?: boolean;
}

export function SuggestionCard({
  suggestion,
  actionLabel,
  actionState,
  onAction,
  disabled,
}: SuggestionCardProps) {
  const isDone = actionState.status === 'done';
  const isRunning = actionState.status === 'running';

  const progressLabel =
    isRunning && actionState.processed !== undefined && actionState.total !== undefined
      ? `${actionState.processed}/${actionState.total}`
      : null;

  return (
    <div
      className={cn(
        'rounded-xl border border-brand-border bg-brand-surface-2 p-4 border-l-4 transition-all duration-300',
        PRIORITY_BORDER[suggestion.priority],
        isDone && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary leading-snug">{suggestion.title}</p>
          <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{suggestion.reason}</p>
        </div>
        {isDone && <CheckCircle2 size={16} className="text-status-success shrink-0 mt-0.5" />}
        {actionState.status === 'error' && (
          <AlertCircle size={16} className="text-status-error shrink-0 mt-0.5" />
        )}
      </div>

      {!isDone && (
        <div className="mt-3">
          <Button
            variant="secondary"
            size="sm"
            loading={isRunning}
            disabled={disabled || isRunning}
            onClick={onAction}
            className="text-xs"
          >
            {isRunning && progressLabel ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                {progressLabel}
              </>
            ) : (
              actionLabel
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
