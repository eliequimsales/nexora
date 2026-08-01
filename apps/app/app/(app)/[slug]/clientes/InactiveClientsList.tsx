'use client';

import { useMemo } from 'react';
import { ArrowRight, PartyPopper } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { getInitials, cn } from '@/lib/utils';
import {
  buildInsights,
  formatBRL,
  type PriorityLevel,
  type RecoveryInsight,
} from '@/lib/recovery/intelligence';
import {
  STATUS_BADGE,
  statusOf,
  type RecoveryStatus,
  type RecoveryStore,
} from '@/lib/recovery/tracking';
import type { InactiveClient } from '@/types';

const AVATAR_COLORS = [
  'bg-brand-purple/30 text-brand-purple',
  'bg-brand-amber-muted text-brand-amber',
  'bg-status-info-muted text-status-info',
  'bg-status-success-muted text-status-success',
  'bg-status-warning-muted text-status-warning',
];

function colorFor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function inactivityReason(days: number) {
  return `Sem interação há ${days} ${days === 1 ? 'dia' : 'dias'}.`;
}

/** Destaque proporcional à urgência — sem sair do design system. */
const PRIORITY_STYLE: Record<
  PriorityLevel,
  { label: string; badge: 'warning' | 'amber' | 'default'; card: string }
> = {
  alta: {
    label: 'Alta prioridade',
    badge: 'warning',
    card: 'border-brand-amber/40 bg-brand-amber-subtle/30',
  },
  media: { label: 'Atenção', badge: 'amber', card: 'border-brand-border bg-brand-surface' },
  baixa: { label: 'Sem pressa', badge: 'default', card: 'border-brand-border bg-brand-surface' },
};

function ClientCard({
  client,
  insight,
  status,
  onRecover,
}: {
  client: InactiveClient;
  insight: RecoveryInsight;
  status: RecoveryStatus;
  onRecover: (client: InactiveClient) => void;
}) {
  const style = PRIORITY_STYLE[insight.priority];
  const statusBadge = STATUS_BADGE[status];
  const isConverted = status === 'converted';

  return (
    <div
      className={cn(
        'group flex items-center gap-4 rounded-xl border p-4 transition-all duration-200 hover:-translate-y-px hover:border-brand-border-2 hover:bg-brand-surface-2/60 hover:shadow-panel',
        isConverted
          ? 'animate-fade-in-up border-status-success/40 bg-status-success-muted/20 opacity-80'
          : style.card,
      )}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0',
          colorFor(client.name),
        )}
        aria-hidden
      >
        {getInitials(client.name)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-text-primary truncate">{client.name}</p>
          <span className="shrink-0 text-xs font-semibold text-status-success">
            {formatBRL(insight.potentialValue)}
          </span>
        </div>
        <p className="text-xs text-text-muted truncate">
          {client.phone ?? client.email ?? 'Sem contato informado'}
        </p>
        {statusBadge && (
          <span className="mt-1 inline-flex sm:hidden">
            <Badge variant={statusBadge.variant} size="sm">
              {statusBadge.label}
            </Badge>
          </span>
        )}
        {!isConverted && (
          <p className="mt-1 text-xs font-medium text-text-secondary sm:hidden">
            {inactivityReason(client.daysSinceLastActivity)} {insight.reason}.
          </p>
        )}
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <Badge variant={statusBadge ? statusBadge.variant : style.badge} size="sm">
          {statusBadge ? statusBadge.label : style.label}
        </Badge>
        {isConverted ? (
          <p className="mt-1.5 text-xs font-medium text-status-success">
            {formatBRL(insight.potentialValue)} recuperados
          </p>
        ) : (
          <>
            <p className="mt-1.5 text-xs text-text-muted">
              {inactivityReason(client.daysSinceLastActivity)}
            </p>
            <p className="text-xs font-medium text-text-secondary">{insight.reason}</p>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => onRecover(client)}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
          isConverted
            ? 'border border-brand-border bg-brand-surface-2 text-text-secondary hover:bg-brand-surface-3'
            : 'bg-brand-purple text-white hover:bg-brand-purpleHover',
        )}
      >
        <span className="hidden sm:inline">{isConverted ? 'Ver' : 'Cuidar agora'}</span>
        <ArrowRight
          size={13}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </button>
    </div>
  );
}

export function InactiveClientsList({
  clients,
  onRecover,
  tracking = {},
}: {
  clients: InactiveClient[];
  onRecover: (client: InactiveClient) => void;
  tracking?: RecoveryStore;
}) {
  // Ordena por prioridade uma vez por mudança de lista — não a cada render.
  // Quem já foi recuperado desce para o fim: continua visível como prova do
  // resultado, sem competir com quem ainda precisa de ação.
  const ranked = useMemo(() => {
    const byPriority = buildInsights(clients);
    return byPriority.sort((a, b) => {
      const aDone = statusOf(tracking, a.client.id) === 'converted' ? 1 : 0;
      const bDone = statusOf(tracking, b.client.id) === 'converted' ? 1 : 0;
      return aDone - bDone;
    });
  }, [clients, tracking]);

  if (ranked.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-brand-border bg-brand-surface/40 p-12 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-status-success-muted flex items-center justify-center">
            <PartyPopper size={26} className="text-status-success" />
          </div>
        </div>
        <p className="text-base font-semibold text-text-primary">
          Todos os seus clientes estão ativos 🎉
        </p>
        <p className="text-sm text-text-muted mt-2 max-w-md mx-auto">
          Ninguém sumiu por aqui. Adicione novos clientes ou importe sua base para
          continuar de olho em quem pode se afastar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {ranked.slice(0, 5).map(({ client, insight }) => (
        <ClientCard
          key={client.id}
          client={client}
          insight={insight}
          status={statusOf(tracking, client.id)}
          onRecover={onRecover}
        />
      ))}
    </div>
  );
}
