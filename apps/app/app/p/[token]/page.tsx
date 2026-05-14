'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CheckCircle2, XCircle, FileText, Loader2 } from 'lucide-react';
import { proposalsApi } from '@/lib/api/proposals.api';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function PublicProposalPage() {
  const params = useParams();
  const token = params.token as string;
  const [responded, setResponded] = useState<'accepted' | 'rejected' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: proposal, isLoading, isError } = useQuery({
    queryKey: ['proposal', 'public', token],
    queryFn: () => proposalsApi.getByToken(token).then((r) => r.data),
    enabled: !!token,
  });

  const accept = useMutation({
    mutationFn: () => proposalsApi.accept(token),
    onSuccess: () => setResponded('accepted'),
    onError: () => setActionError('Não foi possível aceitar a proposta. Tente novamente.'),
  });

  const reject = useMutation({
    mutationFn: () => proposalsApi.reject(token),
    onSuccess: () => setResponded('rejected'),
    onError: () => setActionError('Não foi possível recusar a proposta. Tente novamente.'),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-brand-amber" />
      </div>
    );
  }

  if (isError || !proposal) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center space-y-2">
          <FileText size={40} className="text-text-muted mx-auto opacity-40" />
          <p className="text-sm text-text-primary font-medium">Proposta não encontrada</p>
          <p className="text-xs text-text-muted">O link pode ter expirado ou sido removido.</p>
        </div>
      </div>
    );
  }

  const isExpired = proposal.status === 'expired';
  const alreadyResponded = ['accepted', 'rejected'].includes(proposal.status) || responded !== null;
  const finalStatus = responded ?? (alreadyResponded ? proposal.status : null);

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand-amber flex items-center justify-center mx-auto mb-3">
            <span className="text-brand-bg text-sm font-bold">N</span>
          </div>
          <p className="text-sm text-text-muted">{proposal.orgName}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-brand-border bg-brand-surface shadow-xl overflow-hidden">
          {/* Title */}
          <div className="px-6 py-5 border-b border-brand-border">
            <h1 className="text-lg font-semibold text-text-primary">{proposal.title}</h1>
            {proposal.leadName && (
              <p className="text-sm text-text-muted mt-0.5">Para: {proposal.leadName}</p>
            )}
            {proposal.validUntil && (
              <p className="text-xs text-text-muted mt-1">
                Válida até {formatDate(proposal.validUntil)}
              </p>
            )}
          </div>

          {/* Items */}
          <div className="px-6 py-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-2xs text-text-muted uppercase tracking-wider border-b border-brand-border">
                  <th className="text-left pb-2 font-medium">Descrição</th>
                  <th className="text-right pb-2 font-medium">Qtd.</th>
                  <th className="text-right pb-2 font-medium">Unit.</th>
                  <th className="text-right pb-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {proposal.items.map((item) => (
                  <tr key={item.id} className="border-b border-brand-border/50 last:border-0">
                    <td className="py-2.5 text-text-primary">{item.description}</td>
                    <td className="py-2.5 text-right text-text-secondary">{item.quantity}</td>
                    <td className="py-2.5 text-right text-text-secondary">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2.5 text-right text-text-primary font-medium">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-3 text-sm font-semibold text-text-primary">Total</td>
                  <td className="pt-3 text-right text-base font-bold text-brand-amber">
                    {formatCurrency(proposal.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Note */}
          {proposal.note && (
            <div className="px-6 pb-4">
              <p className="text-xs text-text-muted bg-brand-surface-2 rounded-lg px-3 py-2 leading-relaxed">
                {proposal.note}
              </p>
            </div>
          )}

          {/* Actions / Status */}
          <div className="px-6 py-5 border-t border-brand-border">
            {isExpired && (
              <div className="flex items-center gap-2 justify-center text-sm text-text-muted">
                <XCircle size={16} className="text-status-error" />
                Esta proposta expirou.
              </div>
            )}

            {finalStatus === 'accepted' && (
              <div className="flex flex-col items-center gap-2 text-center">
                <CheckCircle2 size={32} className="text-status-success" />
                <p className="text-sm font-medium text-text-primary">Proposta aceita!</p>
                <p className="text-xs text-text-muted">Entraremos em contato em breve.</p>
              </div>
            )}

            {finalStatus === 'rejected' && (
              <div className="flex flex-col items-center gap-2 text-center">
                <XCircle size={32} className="text-status-error" />
                <p className="text-sm font-medium text-text-primary">Proposta recusada.</p>
                <p className="text-xs text-text-muted">Obrigado pelo retorno.</p>
              </div>
            )}

            {actionError && (
              <p className="text-xs text-status-error text-center mb-3">{actionError}</p>
            )}

            {!alreadyResponded && !isExpired && (
              <div className="flex gap-3">
                <button
                  onClick={() => reject.mutate()}
                  disabled={accept.isPending || reject.isPending}
                  className="flex-1 h-10 rounded-xl border border-brand-border text-sm text-text-secondary hover:bg-brand-surface-2 hover:border-brand-border-2 transition-colors disabled:opacity-40"
                >
                  {reject.isPending ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Recusar'}
                </button>
                <button
                  onClick={() => accept.mutate()}
                  disabled={accept.isPending || reject.isPending}
                  className="flex-1 h-10 rounded-xl bg-brand-amber text-brand-bg text-sm font-semibold hover:bg-brand-amber/90 transition-colors disabled:opacity-40 shadow-glow-amber-sm"
                >
                  {accept.isPending ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Aceitar proposta'}
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-2xs text-text-muted mt-6">
          Powered by Nexora
        </p>
      </div>
    </div>
  );
}
