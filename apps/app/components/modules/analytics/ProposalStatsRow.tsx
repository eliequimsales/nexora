'use client';

import type { ProposalStats } from '@/types';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviada',
  viewed: 'Visualizada',
  accepted: 'Aceita',
  rejected: 'Recusada',
  expired: 'Expirada',
};

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface ProposalStatsRowProps {
  data: ProposalStats | undefined;
  loading?: boolean;
}

export function ProposalStatsRow({ data, loading }: ProposalStatsRowProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-2.5 skeleton w-16" />
            <div className="h-5 skeleton w-10" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {data.byStatus.map((row) => (
          <div key={row.status} className="flex flex-col gap-0.5">
            <p className="text-2xs text-text-muted uppercase tracking-wider">
              {STATUS_LABELS[row.status] ?? row.status}
            </p>
            <p className="text-base font-semibold text-text-primary">{row.count}</p>
            {row.totalAmount > 0 && (
              <p className="text-xs text-text-muted">{formatCurrency(row.totalAmount)}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-6 pt-2 border-t border-brand-border">
        <div>
          <p className="text-2xs text-text-muted">Ticket médio (aceitas)</p>
          <p className="text-sm font-medium text-text-primary">
            {data.avgAcceptedAmount > 0 ? formatCurrency(data.avgAcceptedAmount) : '—'}
          </p>
        </div>
        <div>
          <p className="text-2xs text-text-muted">Tempo médio de resposta</p>
          <p className="text-sm font-medium text-text-primary">
            {data.avgResponseDays != null ? `${data.avgResponseDays} dia${data.avgResponseDays !== 1 ? 's' : ''}` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}
