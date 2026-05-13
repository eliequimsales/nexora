'use client';

import type { FunnelStage } from '@/types';

interface FunnelBarProps {
  stages: FunnelStage[];
  loading?: boolean;
}

export function FunnelBar({ stages, loading }: FunnelBarProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-3 skeleton w-24 shrink-0" />
            <div className="h-6 skeleton flex-1 rounded" />
            <div className="h-3 skeleton w-8 shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (stages.length === 0) {
    return <p className="text-sm text-text-muted text-center py-6">Nenhum estágio configurado.</p>;
  }

  const max = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="space-y-2.5">
      {stages.map((stage) => {
        const pct = Math.max((stage.count / max) * 100, stage.count > 0 ? 4 : 0);
        return (
          <div key={stage.stageId} className="flex items-center gap-3">
            <p className="text-xs text-text-secondary w-28 shrink-0 truncate">{stage.stageName}</p>
            <div className="flex-1 h-6 bg-brand-surface-2 rounded-md overflow-hidden">
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: stage.color + 'cc' }}
              />
            </div>
            <span className="text-xs font-medium text-text-primary w-6 text-right shrink-0">
              {stage.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
