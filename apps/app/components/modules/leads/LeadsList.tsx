'use client';

import { useState } from 'react';
import { User, Flame, Thermometer, Snowflake, ChevronLeft, ChevronRight, Users, AlertCircle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useLeadsQuery } from '@/lib/hooks/leads/useLeadsQuery';
import { LeadDetailModal } from './LeadDetailModal';
import { formatRelativeTime } from '@/lib/utils';
import type { Lead, LeadStatus, LeadClassification } from '@/types';

const STATUS_CONFIG: Record<LeadStatus, { label: string; variant: 'default' | 'info' | 'success' | 'error' | 'warning' }> = {
  new: { label: 'Novo', variant: 'info' },
  contacted: { label: 'Contactado', variant: 'warning' },
  qualified: { label: 'Qualificado', variant: 'success' },
  disqualified: { label: 'Descartado', variant: 'error' },
  closed_won: { label: 'Ganho', variant: 'success' },
  closed_lost: { label: 'Perdido', variant: 'default' },
};

const CLASSIFICATION_CONFIG: Record<LeadClassification, { label: string; icon: React.ElementType; variant: 'amber' | 'warning' | 'default' }> = {
  hot: { label: 'Quente', icon: Flame, variant: 'amber' },
  warm: { label: 'Morno', icon: Thermometer, variant: 'warning' },
  cold: { label: 'Frio', icon: Snowflake, variant: 'default' },
};

function LeadRow({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const status = STATUS_CONFIG[lead.status] ?? { label: lead.status, variant: 'default' as const };
  const classification = lead.aiClassification ? CLASSIFICATION_CONFIG[lead.aiClassification] : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="flex items-center gap-4 py-3.5 border-b border-brand-border last:border-0 hover:bg-brand-surface-2/40 px-1 -mx-1 rounded transition-colors cursor-pointer"
    >
      {/* Avatar placeholder */}
      <span className="w-8 h-8 rounded-full bg-brand-surface-2 border border-brand-border flex items-center justify-center shrink-0">
        <User size={14} className="text-text-muted" />
      </span>

      {/* Name + contact */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{lead.name}</p>
        <p className="text-xs text-text-muted truncate">
          {lead.email ?? lead.phone ?? '—'}
        </p>
      </div>

      {/* AI classification */}
      {classification && (
        <Badge variant={classification.variant} size="sm" className="hidden sm:inline-flex shrink-0">
          <classification.icon size={10} />
          {classification.label}
        </Badge>
      )}

      {/* Status */}
      <Badge variant={status.variant} size="sm" className="shrink-0">
        {status.label}
      </Badge>

      {/* Time */}
      <span className="text-2xs text-text-muted shrink-0 hidden md:block">
        {formatRelativeTime(lead.createdAt)}
      </span>
    </div>
  );
}

interface LeadsListProps {
  search?: string;
  status?: LeadStatus;
}

function LeadsListSkeleton() {
  return (
    <div className="space-y-0 divide-y divide-brand-border">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} variant="table-row" />
      ))}
    </div>
  );
}

export function LeadsList({ search, status }: LeadsListProps) {
  const [page, setPage] = useState(1);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const { data, isLoading, isError } = useLeadsQuery({ page, limit: 20, search, status });

  if (isLoading) {
    return <LeadsListSkeleton />;
  }

  if (isError) {
    return (
      <div className="py-12 text-center">
        <AlertCircle size={22} className="text-status-error mx-auto mb-3 opacity-70" />
        <p className="text-sm font-medium text-text-primary">Não foi possível carregar os leads</p>
        <p className="text-xs text-text-muted mt-1 flex items-center justify-center gap-1">
          <RefreshCw size={11} />
          Recarregue a página para tentar novamente
        </p>
      </div>
    );
  }

  const leads = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  if (leads.length === 0) {
    const isFiltered = Boolean(search || status);
    return (
      <EmptyState
        icon={<Users size={24} />}
        title={isFiltered ? 'Nenhum lead encontrado' : 'Ainda sem leads'}
        description={
          isFiltered
            ? 'Tente outros filtros ou limpe a busca.'
            : 'Clique em "Novo lead" para adicionar o primeiro.'
        }
      />
    );
  }

  return (
    <>
      {selectedLead && (
        <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
      )}

      <div>
        {leads.map((lead) => (
          <LeadRow key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />
        ))}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-brand-border">
            <p className="text-xs text-text-muted">
              {total} lead{total !== 1 ? 's' : ''} no total
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <span className="text-xs text-text-secondary">{page} / {totalPages}</span>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
