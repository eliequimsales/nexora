'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, XCircle, ChevronRight, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToggleWorkflow } from '@/lib/hooks/workflows/useToggleWorkflow';
import { TRIGGER_LABELS, ACTION_LABELS } from '@/types';
import type { WorkflowWithStats } from '@/types';

interface WorkflowRowProps {
  workflow: WorkflowWithStats;
  onClick: () => void;
}

function isPromptMissing(workflow: WorkflowWithStats): boolean {
  if (workflow.latestExecutionStatus !== 'failed') return false;
  const reason = workflow.latestExecutionResult?.errorReason;
  return reason === 'ai_prompt_not_configured';
}

export function WorkflowRow({ workflow, onClick }: WorkflowRowProps) {
  const { mutate: toggle, isPending } = useToggleWorkflow();
  const params = useParams<{ slug: string }>();
  const promptMissing = isPromptMissing(workflow);

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    toggle({ id: workflow.id, isActive: !workflow.isActive });
  }

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 py-4 px-1 border-b border-brand-border last:border-0 hover:bg-brand-surface-2/40 cursor-pointer rounded transition-colors -mx-1"
    >
      {/* Toggle */}
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={cn(
          'relative w-9 h-5 rounded-full shrink-0 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber/60',
          workflow.isActive ? 'bg-brand-amber' : 'bg-brand-surface-3',
          isPending && 'opacity-50',
        )}
        aria-label={workflow.isActive ? 'Desativar' : 'Ativar'}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
            workflow.isActive && 'translate-x-4',
          )}
        />
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{workflow.name}</p>
        <p className="text-xs text-text-muted mt-0.5">
          <span>{TRIGGER_LABELS[workflow.triggerType]}</span>
          <span className="mx-1.5 text-text-muted/50">→</span>
          <span>{ACTION_LABELS[workflow.actionType]}</span>
        </p>
        {promptMissing && (
          <Link
            href={`/${params.slug}/settings`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-status-error hover:text-status-error/80 transition-colors"
          >
            <Settings size={11} />
            Configurar IA
          </Link>
        )}
      </div>

      {/* Stats */}
      {workflow.executionsToday > 0 && (
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 text-xs text-status-success">
            <CheckCircle2 size={12} />
            <span>{workflow.successToday}</span>
          </div>
          {workflow.failedToday > 0 && (
            <div className="flex items-center gap-1 text-xs text-status-error">
              <XCircle size={12} />
              <span>{workflow.failedToday}</span>
            </div>
          )}
          <span className="text-xs text-text-muted">{workflow.executionsToday} hoje</span>
        </div>
      )}

      <ChevronRight size={14} className="text-text-muted shrink-0" />
    </div>
  );
}
