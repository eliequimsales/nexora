'use client';

import type { AiStats } from '@/types';

const ACTION_LABELS: Record<string, string> = {
  classify: 'Classificações',
  respond: 'Respostas',
  follow_up: 'Follow-ups',
};

interface AiStatsRowProps {
  data: AiStats | undefined;
  loading?: boolean;
}

export function AiStatsRow({ data, loading }: AiStatsRowProps) {
  if (loading) {
    return (
      <div className="flex gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-2.5 skeleton w-20" />
            <div className="h-5 skeleton w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.byActionType.length === 0) {
    return <p className="text-xs text-text-muted">Nenhuma execução de IA no período.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-6">
        {data.byActionType.map((row) => (
          <div key={row.actionType}>
            <p className="text-2xs text-text-muted uppercase tracking-wider mb-0.5">
              {ACTION_LABELS[row.actionType] ?? row.actionType}
            </p>
            <p className="text-base font-semibold text-text-primary">{row.total}</p>
            <p className="text-xs text-text-muted">{row.successRate}% sucesso</p>
          </div>
        ))}
      </div>

      {data.tokensUsed > 0 && (
        <p className="text-xs text-text-muted pt-2 border-t border-brand-border">
          {data.tokensUsed.toLocaleString('pt-BR')} tokens consumidos
        </p>
      )}
    </div>
  );
}
