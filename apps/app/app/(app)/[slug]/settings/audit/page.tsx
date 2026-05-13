'use client';

import { useState } from 'react';
import { Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuditLogs } from '@/lib/hooks/audit-logs/useAuditLogs';
import { formatRelativeTime } from '@/lib/utils';
import { CanDo } from '@/components/shared/CanDo/CanDo';

const ACTION_LABELS: Record<string, string> = {
  'user.role_changed': 'Role alterado',
  'user.deactivated': 'Usuário desativado',
  'user.login': 'Login',
  'user.login_failed': 'Login falhou',
  'workflow.created': 'Workflow criado',
  'workflow.toggled': 'Workflow ativado/desativado',
  'workflow.deleted': 'Workflow deletado',
  'org.settings_updated': 'Configurações alteradas',
  'org.ai_prompt_updated': 'Prompt de IA atualizado',
};

const RESOURCE_LABELS: Record<string, string> = {
  user: 'Usuário',
  workflow: 'Workflow',
  org: 'Organização',
  pipeline_stage: 'Estágio',
  proposal: 'Proposta',
};

const ACTION_FILTERS = [
  { label: 'Todos', value: '' },
  { label: 'Usuários', value: 'user.' },
  { label: 'Workflows', value: 'workflow.' },
  { label: 'Organização', value: 'org.' },
];

function AuditRow({ item }: { item: import('@/types').AuditLogItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasMetadata = item.metadata && Object.keys(item.metadata).length > 0;

  return (
    <div className="py-3 border-b border-brand-border last:border-0">
      <div
        className={`flex items-start gap-4 ${hasMetadata ? 'cursor-pointer' : ''}`}
        onClick={() => hasMetadata && setExpanded((v) => !v)}
      >
        {/* Action */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-text-primary">
            {ACTION_LABELS[item.action] ?? item.action}
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            {item.resourceName && (
              <span className="font-medium text-text-secondary">{item.resourceName} </span>
            )}
            {item.resourceType && (
              <span className="text-text-muted">
                ({RESOURCE_LABELS[item.resourceType] ?? item.resourceType})
              </span>
            )}
          </p>
        </div>

        {/* Actor */}
        <div className="hidden sm:block shrink-0 text-right">
          <p className="text-xs text-text-secondary">{item.actorEmail}</p>
          <p className="text-2xs text-text-muted capitalize">{item.actorRole}</p>
        </div>

        {/* Time */}
        <span className="text-2xs text-text-muted shrink-0 pt-0.5">
          {formatRelativeTime(item.createdAt)}
        </span>
      </div>

      {expanded && hasMetadata && (
        <pre className="mt-2 text-2xs text-text-muted bg-brand-surface-2 rounded-lg px-3 py-2 overflow-auto">
          {JSON.stringify(item.metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');

  const { data, isLoading, isError } = useAuditLogs({
    action: actionFilter || undefined,
    page,
    limit: 30,
  });

  const items = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <CanDo permission="audit-logs:read" fallback={
      <div className="p-6">
        <p className="text-sm text-status-error">Acesso restrito a administradores.</p>
      </div>
    }>
      <div className="p-6 max-w-4xl">
        <div className="flex items-center gap-2.5 mb-6">
          <Shield size={18} className="text-text-secondary" />
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Audit Log</h1>
            <p className="text-xs text-text-muted">Registro de mutações sensíveis da organização</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {ACTION_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => { setActionFilter(f.value); setPage(1); }}
              className={[
                'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                actionFilter === f.value
                  ? 'bg-brand-amber text-brand-bg'
                  : 'text-text-muted hover:text-text-primary hover:bg-brand-surface-2',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
          {isLoading && (
            <div className="space-y-3 py-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-4 py-2">
                  <div className="flex-1">
                    <div className="h-3 skeleton w-1/3 mb-1.5" />
                    <div className="h-2.5 skeleton w-1/4" />
                  </div>
                  <div className="h-3 skeleton w-28 shrink-0" />
                  <div className="h-3 skeleton w-12 shrink-0" />
                </div>
              ))}
            </div>
          )}

          {isError && (
            <p className="text-sm text-status-error text-center py-6">
              Erro ao carregar logs.
            </p>
          )}

          {!isLoading && !isError && items.length === 0 && (
            <div className="text-center py-12">
              <Shield size={32} className="text-text-muted mx-auto mb-3 opacity-30" />
              <p className="text-sm text-text-muted">Nenhum evento registrado ainda.</p>
            </div>
          )}

          {!isLoading && !isError && items.length > 0 && (
            <>
              <div className="hidden sm:flex gap-4 pb-2 border-b border-brand-border mb-1">
                <p className="text-2xs text-text-muted uppercase tracking-wider flex-1">Evento</p>
                <p className="text-2xs text-text-muted uppercase tracking-wider w-40 text-right">Ator</p>
                <p className="text-2xs text-text-muted uppercase tracking-wider w-16 text-right">Quando</p>
              </div>
              {items.map((item) => <AuditRow key={item.id} item={item} />)}
            </>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-brand-border">
              <p className="text-xs text-text-muted">{data?.total ?? 0} eventos</p>
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
      </div>
    </CanDo>
  );
}
