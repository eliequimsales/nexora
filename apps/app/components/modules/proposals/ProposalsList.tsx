'use client';

import { useState } from 'react';
import {
  FileText, Send, Eye, CheckCircle2, XCircle, Clock,
  Copy, ChevronLeft, ChevronRight, MoreHorizontal,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useProposalsQuery } from '@/lib/hooks/proposals/useProposalsQuery';
import { useSendProposal } from '@/lib/hooks/proposals/useSendProposal';
import { formatRelativeTime } from '@/lib/utils';
import type { Proposal, ProposalStatus } from '@/types';

const STATUS_CONFIG: Record<ProposalStatus, {
  label: string;
  icon: React.ElementType;
  variant: 'default' | 'info' | 'warning' | 'success' | 'error' | 'amber';
}> = {
  draft:    { label: 'Rascunho',  icon: FileText,    variant: 'default' },
  sent:     { label: 'Enviada',   icon: Send,        variant: 'info' },
  viewed:   { label: 'Visualizada', icon: Eye,       variant: 'warning' },
  accepted: { label: 'Aceita',    icon: CheckCircle2, variant: 'success' },
  rejected: { label: 'Recusada',  icon: XCircle,     variant: 'error' },
  expired:  { label: 'Expirada',  icon: Clock,       variant: 'default' },
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface ProposalRowProps {
  proposal: Proposal;
  onSend: (id: string) => void;
  isSending: boolean;
}

function ProposalRow({ proposal, onSend, isSending }: ProposalRowProps) {
  const cfg = STATUS_CONFIG[proposal.status];
  const StatusIcon = cfg.icon;

  function copyLink() {
    if (!proposal.token) return;
    const link = `${window.location.origin}/p/${proposal.token}`;
    navigator.clipboard.writeText(link).catch(() => undefined);
  }

  return (
    <div className="flex items-center gap-4 py-3.5 border-b border-brand-border last:border-0 hover:bg-brand-surface-2/40 px-1 -mx-1 rounded transition-colors">
      {/* Icon */}
      <span className="w-8 h-8 rounded-lg bg-brand-surface-2 border border-brand-border flex items-center justify-center shrink-0">
        <FileText size={14} className="text-text-muted" />
      </span>

      {/* Title + lead */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{proposal.title}</p>
        <p className="text-xs text-text-muted truncate">{proposal.leadName ?? '—'}</p>
      </div>

      {/* Amount */}
      <span className="text-sm font-medium text-text-primary shrink-0 hidden sm:block">
        {formatCurrency(proposal.totalAmount)}
      </span>

      {/* Status */}
      <Badge variant={cfg.variant} size="sm" className="shrink-0">
        <StatusIcon size={10} />
        {cfg.label}
      </Badge>

      {/* Date */}
      <span className="text-2xs text-text-muted shrink-0 hidden md:block">
        {formatRelativeTime(proposal.createdAt)}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {proposal.status === 'draft' && (
          <Button
            variant="secondary"
            size="sm"
            loading={isSending}
            onClick={() => onSend(proposal.id)}
            className="text-xs"
          >
            <Send size={11} />
            Enviar
          </Button>
        )}
        {proposal.token && (
          <button
            onClick={copyLink}
            title="Copiar link"
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-brand-surface-2 transition-colors"
          >
            <Copy size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

const STATUS_FILTERS: { label: string; value: ProposalStatus | undefined }[] = [
  { label: 'Todas', value: undefined },
  { label: 'Rascunho', value: 'draft' },
  { label: 'Enviadas', value: 'sent' },
  { label: 'Visualizadas', value: 'viewed' },
  { label: 'Aceitas', value: 'accepted' },
  { label: 'Recusadas', value: 'rejected' },
];

interface ProposalsListProps {
  leadId?: string;
}

export function ProposalsList({ leadId }: ProposalsListProps) {
  const [page, setPage] = useState(1);
  const [activeStatus, setActiveStatus] = useState<ProposalStatus | undefined>(undefined);
  const { data, isLoading, isError } = useProposalsQuery({ page, limit: 20, status: activeStatus, leadId });
  const { mutate: send, isPending: isSending, variables: sendingId } = useSendProposal();

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <div className="w-8 h-8 skeleton rounded-lg shrink-0" />
            <div className="flex-1">
              <div className="h-3 skeleton w-1/3 mb-1.5" />
              <div className="h-2.5 skeleton w-1/4" />
            </div>
            <div className="h-4 skeleton w-20 rounded" />
            <div className="h-5 skeleton w-20 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-status-error py-6 text-center">
        Erro ao carregar propostas.
      </p>
    );
  }

  const proposals = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div>
      {/* Status filters */}
      {!leadId && (
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => { setActiveStatus(f.value); setPage(1); }}
              className={[
                'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                activeStatus === f.value
                  ? 'bg-brand-amber text-brand-bg'
                  : 'text-text-muted hover:text-text-primary hover:bg-brand-surface-2',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {proposals.length === 0 ? (
        <div className="py-12 text-center">
          <FileText size={32} className="text-text-muted mx-auto mb-3 opacity-40" />
          <p className="text-sm text-text-muted">Nenhuma proposta encontrada.</p>
        </div>
      ) : (
        <div className="divide-y divide-brand-border">
          {proposals.map((p) => (
            <ProposalRow
              key={p.id}
              proposal={p}
              onSend={send}
              isSending={isSending && sendingId === p.id}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-brand-border">
          <p className="text-xs text-text-muted">
            {total} proposta{total !== 1 ? 's' : ''}
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
  );
}
