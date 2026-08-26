'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useLeadsQuery } from '@/lib/hooks/leads/useLeadsQuery';
import { formatRelativeTime } from '@/lib/utils';
import { LeadDetailModal } from './LeadDetailModal';
import type { Lead } from '@/types';

function ClientRow({ client, onClick }: { client: Lead; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-lg border-b border-brand-border px-2 py-3.5 text-left transition-colors last:border-0 hover:bg-brand-surface-2/60"
    >
      <Avatar name={client.name} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{client.name}</p>
        <p className="text-xs text-text-muted truncate">
          {client.email ?? client.phone ?? 'Sem contato informado'}
        </p>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-2xs uppercase tracking-wider text-text-muted">
          Na Nexora
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          {formatRelativeTime(client.createdAt)}
        </p>
      </div>

      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-border bg-brand-surface-2 text-text-muted transition-colors group-hover:border-brand-amber/30 group-hover:text-brand-amber">
        <ChevronRight size={14} />
      </span>
    </button>
  );
}

function ClientsListSkeleton() {
  return (
    <div className="space-y-0 divide-y divide-brand-border">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} variant="table-row" />
      ))}
    </div>
  );
}

export function LeadsList({ search }: { search?: string }) {
  const [page, setPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState<Lead | null>(null);
  const { data, isLoading, isError, isFetching } = useLeadsQuery({
    page,
    limit: 20,
    search,
  });

  useEffect(() => {
    setPage(1);
  }, [search]);

  if (isLoading) {
    return <ClientsListSkeleton />;
  }

  if (isError) {
    return (
      <div className="py-12 text-center">
        <AlertCircle size={22} className="text-status-error mx-auto mb-3 opacity-70" />
        <p className="text-sm font-medium text-text-primary">
          Não foi possível carregar os clientes
        </p>
        <p className="text-xs text-text-muted mt-1 flex items-center justify-center gap-1">
          <RefreshCw size={11} />
          Recarregue a página para tentar novamente
        </p>
      </div>
    );
  }

  const clients = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  if (clients.length === 0) {
    return (
      <EmptyState
        icon={<Users size={24} />}
        title={search ? 'Nenhum cliente encontrado' : 'Ainda não há clientes'}
        description={
          search
            ? 'Tente buscar por outro nome, email ou telefone.'
            : 'Use "Adicionar cliente" ou "Importar clientes" aqui em cima para começar.'
        }
      />
    );
  }

  return (
    <>
      {selectedClient && (
        <LeadDetailModal lead={selectedClient} onClose={() => setSelectedClient(null)} />
      )}

      <div aria-busy={isFetching}>
        <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {clients.map((client) => (
            <ClientRow
              key={client.id}
              client={client}
              onClick={() => setSelectedClient(client)}
            />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-brand-border">
            <p className="text-xs text-text-muted">
              {total} {total === 1 ? 'cliente' : 'clientes'} no total
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Página anterior"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((currentPage) => currentPage - 1)}
              >
                <ChevronLeft size={14} />
              </Button>
              <span className="text-xs text-text-secondary">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Próxima página"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((currentPage) => currentPage + 1)}
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
