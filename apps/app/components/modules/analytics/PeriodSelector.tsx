'use client';

import { cn } from '@/lib/utils';
import type { AnalyticsPeriod } from '@/types';

const OPTIONS: { label: string; value: AnalyticsPeriod }[] = [
  { label: '7 dias', value: '7d' },
  { label: '30 dias', value: '30d' },
  { label: '90 dias', value: '90d' },
];

interface PeriodSelectorProps {
  value: AnalyticsPeriod;
  onChange: (period: AnalyticsPeriod) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-brand-border bg-brand-surface-2 p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'px-3 py-1 rounded-md text-xs font-medium transition-colors',
            value === o.value
              ? 'bg-brand-amber text-brand-bg shadow-sm'
              : 'text-text-muted hover:text-text-primary',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
