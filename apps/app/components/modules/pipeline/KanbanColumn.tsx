'use client';

import { cn } from '@/lib/utils';
import { LeadCard } from './LeadCard';
import type { PipelineStage } from '@/types';

const STAGE_TYPE_LABEL = {
  active: null,
  won: 'Ganho',
  lost: 'Perdido',
} as const;

interface KanbanColumnProps {
  stage: PipelineStage;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent, leadId: string, fromStageId: string) => void;
  onDragOver: (e: React.DragEvent, stageId: string) => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
  onDragLeave: () => void;
}

export function KanbanColumn({
  stage,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragLeave,
}: KanbanColumnProps) {
  const typeLabel = STAGE_TYPE_LABEL[stage.stageType];

  return (
    <div
      className="flex flex-col min-w-[260px] max-w-[260px]"
      onDragOver={(e) => onDragOver(e, stage.id)}
      onDrop={(e) => onDrop(e, stage.id)}
      onDragLeave={onDragLeave}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Color dot */}
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: stage.color }}
          />
          <span className="text-xs font-semibold text-text-primary">{stage.name}</span>
          {typeLabel && (
            <span className="text-2xs text-text-muted">({typeLabel})</span>
          )}
        </div>
        <span className="text-2xs font-medium text-text-muted bg-brand-surface-2 border border-brand-border rounded-md px-1.5 py-0.5 tabular-nums">
          {stage.leadCount}
        </span>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          'flex-1 rounded-xl border-2 border-dashed p-2 space-y-2 min-h-[200px] transition-colors duration-150',
          isDragOver
            ? 'border-brand-amber/60 bg-brand-amber/5'
            : 'border-brand-border bg-brand-surface/50',
        )}
      >
        {stage.leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onDragStart={(e, id) => onDragStart(e, id, stage.id)}
          />
        ))}

        {stage.leads.length === 0 && (
          <div className="flex items-center justify-center h-20">
            <p className="text-2xs text-text-muted">Sem leads aqui</p>
          </div>
        )}
      </div>
    </div>
  );
}
