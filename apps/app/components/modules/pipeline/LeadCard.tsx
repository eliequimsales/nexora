'use client';

import { Flame, Thermometer, Snowflake, Mail, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StageLead } from '@/types';

const CLASSIFICATION_ICON = {
  hot: { Icon: Flame, className: 'text-brand-amber' },
  warm: { Icon: Thermometer, className: 'text-status-warning' },
  cold: { Icon: Snowflake, className: 'text-status-info' },
} as const;

interface LeadCardProps {
  lead: StageLead;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, leadId: string) => void;
}

export function LeadCard({ lead, isDragging = false, onDragStart }: LeadCardProps) {
  const classification = lead.aiClassification
    ? CLASSIFICATION_ICON[lead.aiClassification]
    : null;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart?.(e, lead.id)}
      className={cn(
        'rounded-lg border border-brand-border bg-brand-bg p-3 cursor-grab active:cursor-grabbing select-none',
        'hover:border-brand-border-2 hover:shadow-sm transition-all duration-150',
        isDragging && 'opacity-50 ring-2 ring-brand-amber/40',
      )}
    >
      {/* Name + AI icon */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-xs font-medium text-text-primary leading-snug flex-1 min-w-0 truncate">
          {lead.name}
        </p>
        {classification && (
          <classification.Icon
            size={12}
            className={cn('shrink-0 mt-0.5', classification.className)}
          />
        )}
      </div>

      {/* Contact info */}
      <div className="space-y-1">
        {lead.email && (
          <div className="flex items-center gap-1.5">
            <Mail size={10} className="text-text-muted shrink-0" />
            <span className="text-2xs text-text-muted truncate">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-1.5">
            <Phone size={10} className="text-text-muted shrink-0" />
            <span className="text-2xs text-text-muted truncate">{lead.phone}</span>
          </div>
        )}
      </div>

      {/* AI score */}
      {lead.aiScore !== null && (
        <div className="mt-2 pt-2 border-t border-brand-border flex items-center justify-between">
          <span className="text-2xs text-text-muted">Score IA</span>
          <span className="text-2xs font-semibold text-brand-amber tabular-nums">
            {lead.aiScore}
          </span>
        </div>
      )}
    </div>
  );
}
