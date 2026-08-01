'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { CanDo } from '@/components/shared/CanDo/CanDo';
import { CreateLeadForm } from '@/components/modules/leads/CreateLeadForm';
import { LeadsList } from '@/components/modules/leads/LeadsList';
import { LgpdAcceptanceBanner } from '@/components/modules/legal/LgpdAcceptanceBanner';
import { useInactiveClientsQuery } from '@/lib/hooks/leads/useInactiveClientsQuery';
import { formatBRL, totalPotential } from '@/lib/recovery/intelligence';
import { useRecoveryTracking } from '@/lib/hooks/recovery/useRecoveryTracking';
import { statusOf } from '@/lib/recovery/tracking';
import { RecoveryHero } from './RecoveryHero';
import { InactiveClientsList } from './InactiveClientsList';
import { RecoveryModal } from './RecoveryModal';
import type { InactiveClient } from '@/types';

export default function ClientesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<InactiveClient | null>(null);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const attentionQuery = useInactiveClientsQuery();
  const attentionClients = useMemo(() => attentionQuery.data ?? [], [attentionQuery.data]);
  const potentialTotal = useMemo(
    () => totalPotential(attentionClients),
    [attentionClients],
  );
  const tracking = useRecoveryTracking();

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:space-y-6 sm:p-6">
        <LgpdAcceptanceBanner />

        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href={`/${slug}/clientes/importar`}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-border bg-brand-surface px-4 py-2 text-sm font-medium text-text-primary shadow-panel transition-all hover:-translate-y-px hover:border-brand-border-2 hover:bg-brand-surface-2"
          >
            <Upload size={14} />
            Importar clientes
          </Link>

          <CanDo permission="leads:create">
            <button
              type="button"
              onClick={() => setIsAddingClient(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-amber/30 bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-bg shadow-glow-amber-sm transition-all hover:-translate-y-px hover:bg-brand-amber/90"
            >
              <Plus size={14} />
              Adicionar cliente
            </button>
          </CanDo>
        </div>

        {/* Resultado do dia — só aparece quando existe resultado de verdade. */}
        {tracking.hydrated && tracking.today.count > 0 && (
          <section className="animate-fade-in-up overflow-hidden rounded-xl border border-status-success/30 bg-status-success-muted/20 px-4 py-4 shadow-panel sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-status-success/25 bg-status-success-muted">
                  <TrendingUp size={17} className="text-status-success" />
                </span>
                <div>
                  <p className="text-2xs font-semibold uppercase tracking-widest text-status-success">
                    Hoje você recuperou
                  </p>
                  <p className="mt-0.5 text-2xl font-bold leading-tight text-text-primary">
                    {formatBRL(tracking.today.value)}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold text-text-primary">
                  {tracking.today.count}{' '}
                  {tracking.today.count === 1 ? 'cliente' : 'clientes'}
                </p>
                <p className="text-2xs text-text-muted">
                  {tracking.allTime.count > tracking.today.count
                    ? `${formatBRL(tracking.allTime.value)} no total`
                    : 'marcados por você'}
                </p>
              </div>
            </div>
          </section>
        )}

        <RecoveryHero />

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="self-start overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-panel animate-fade-in-up">
            <header className="flex items-start justify-between gap-4 border-b border-brand-border px-4 py-4 sm:px-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-amber/20 bg-brand-amber-subtle">
                  <Sparkles size={15} className="text-brand-amber" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">
                    Quem você pode recuperar hoje
                  </h2>
                  <p className="mt-0.5 text-xs leading-5 text-text-muted">
                    {attentionClients.length > 0 ? (
                      <>
                        <span className="font-semibold text-status-success">
                          {formatBRL(potentialTotal)}
                        </span>{' '}
                        em jogo nessa lista — estimativa pelo seu ticket médio.
                      </>
                    ) : (
                      'O Analista mostra a razão. Você decide como cuidar.'
                    )}
                  </p>
                </div>
              </div>

              {!attentionQuery.isLoading && !attentionQuery.isError && (
                <Badge variant="warning" size="sm" className="shrink-0">
                  {attentionClients.length}
                </Badge>
              )}
            </header>

            <div className="p-3 sm:p-4">
              {attentionQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} variant="table-row" />
                  ))}
                </div>
              ) : attentionQuery.isError ? (
                <div className="rounded-xl border border-status-error/30 bg-status-error-muted/50 p-6 text-center">
                  <AlertCircle size={22} className="mx-auto mb-3 text-status-error" />
                  <p className="text-sm font-medium text-text-primary">
                    Não foi possível carregar quem precisa de atenção
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-text-muted">
                    <RefreshCw size={11} />
                    Recarregue a página para tentar novamente
                  </p>
                </div>
              ) : (
                <InactiveClientsList
                  clients={attentionClients}
                  onRecover={setSelectedClient}
                  tracking={tracking.store}
                />
              )}
            </div>
          </section>

          <section
            className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-panel animate-fade-in-up"
            style={{ animationDelay: '70ms', animationFillMode: 'both' }}
          >
            <header className="border-b border-brand-border px-4 py-4 sm:px-5">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-purple/20 bg-brand-purple/15">
                  <Users size={15} className="text-brand-purple" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">
                    Todos os clientes
                  </h2>
                  <p className="mt-0.5 text-xs leading-5 text-text-muted">
                    Sua base completa, organizada para encontrar qualquer pessoa.
                  </p>
                </div>
              </div>

              <Input
                type="search"
                aria-label="Pesquisar clientes"
                placeholder="Buscar por nome, e-mail ou telefone..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                iconLeft={<Search size={14} />}
              />
            </header>

            <div className="p-3 sm:p-4">
              <LeadsList search={search || undefined} />
            </div>
          </section>
        </div>
      </div>

      <RecoveryModal
        client={selectedClient}
        onClose={() => setSelectedClient(null)}
        status={
          selectedClient ? statusOf(tracking.store, selectedClient.id) : 'idle'
        }
        onTrack={tracking.setStatus}
      />

      {isAddingClient && <CreateLeadForm onClose={() => setIsAddingClient(false)} />}
    </>
  );
}
