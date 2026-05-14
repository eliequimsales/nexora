'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/lib/providers/ToastProvider';
import { useInactiveClientsQuery } from '@/lib/hooks/leads/useInactiveClientsQuery';
import { cn } from '@/lib/utils';
import { RecoveryHero } from './RecoveryHero';
import { InactiveClientsList } from './InactiveClientsList';
import type { InactiveClient } from '@/types';

type TabKey = 'inactive' | 'all' | 'recovered';

const TABS: { key: TabKey; label: string; disabled?: boolean }[] = [
  { key: 'inactive', label: 'Inativos (30+ dias)' },
  { key: 'all', label: 'Todos os clientes', disabled: true },
  { key: 'recovered', label: 'Recuperados este mês', disabled: true },
];

export default function ClientesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('inactive');
  const { data, isLoading, isError } = useInactiveClientsQuery(30);
  const { toast } = useToast();

  const clients = useMemo<InactiveClient[]>(() => data ?? [], [data]);

  const potentialRevenue = useMemo(
    () => clients.reduce((sum, c) => sum + (c.estimatedValue ?? 0), 0),
    [clients],
  );

  function handleRecoverOne(client: InactiveClient) {
    // TODO: open a confirm modal and POST to
    // /api/v1/assistente-financeiro/generate-message + send-message.
    // Optimistic toast for now so the screen feels alive.
    toast({
      variant: 'ai',
      title: `Recuperação enviada para ${client.name}`,
      description: 'A Nexora vai personalizar a mensagem e disparar via WhatsApp.',
    });
  }

  function handleRecoverAll() {
    if (clients.length === 0) return;
    // TODO: batch generation + delivery via assistente-financeiro module.
    toast({
      variant: 'ai',
      title: `Recuperação em lote disparada (${clients.length} clientes)`,
      description: 'Acompanhe o status de cada envio na lista.',
    });
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <RecoveryHero
        inactiveCount={clients.length}
        potentialRevenue={potentialRevenue}
        onRecoverAll={handleRecoverAll}
        isLoading={isLoading}
      />

      {/* Tabs */}
      <div
        role="tablist"
        className="flex gap-1 border-b border-brand-border overflow-x-auto pb-px"
      >
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && setActiveTab(tab.key)}
              className={cn(
                'shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-brand-amber text-text-primary'
                  : 'border-transparent text-text-muted hover:text-text-secondary',
                tab.disabled && 'opacity-40 cursor-not-allowed',
              )}
            >
              {tab.label}
              {tab.disabled && (
                <span className="ml-2 text-2xs text-text-muted/70">em breve</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="table-row" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error-muted/50 p-6 text-center">
          <AlertCircle size={22} className="text-status-error mx-auto mb-3" />
          <p className="text-sm font-medium text-text-primary">
            Não foi possível carregar os clientes inativos
          </p>
          <p className="text-xs text-text-muted mt-1 inline-flex items-center gap-1">
            <RefreshCw size={11} />
            Recarregue a página para tentar novamente
          </p>
        </div>
      ) : (
        <InactiveClientsList clients={clients} onRecover={handleRecoverOne} />
      )}
    </div>
  );
}
