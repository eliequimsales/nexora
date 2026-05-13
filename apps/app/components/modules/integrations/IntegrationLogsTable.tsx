'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useIntegrationLogs } from '@/lib/hooks/integrations/useIntegrationLogs';
import { formatRelativeTime } from '@/lib/utils';

const CHANNEL_FILTERS = [
  { label: 'Todos', value: '' },
  { label: 'Webhook', value: 'webhook' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'E-mail', value: 'email' },
  { label: 'Ingest', value: 'ingest' },
];

const STATUS_FILTERS = [
  { label: 'Todos', value: '' },
  { label: 'Sucesso', value: 'success' },
  { label: 'Falha', value: 'failed' },
];

export function IntegrationLogsTable() {
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useIntegrationLogs({
    channel: channel || undefined,
    status: status || undefined,
    page,
    limit: 30,
  });

  const rows = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div>
      <p className="text-sm font-semibold text-text-primary mb-3">Logs de integração</p>

      <div className="flex gap-1 flex-wrap mb-3">
        {CHANNEL_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setChannel(f.value); setPage(1); }}
            className={[
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
              channel === f.value
                ? 'bg-brand-amber text-brand-bg'
                : 'text-text-muted hover:text-text-primary hover:bg-brand-surface-2',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
        <span className="px-1 text-text-muted text-xs self-center">|</span>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatus(f.value); setPage(1); }}
            className={[
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
              status === f.value
                ? 'bg-brand-amber text-brand-bg'
                : 'text-text-muted hover:text-text-primary hover:bg-brand-surface-2',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-brand-border bg-brand-surface-2">
              <th className="text-left px-4 py-2.5 text-text-muted font-medium uppercase tracking-wider">Canal</th>
              <th className="text-left px-4 py-2.5 text-text-muted font-medium uppercase tracking-wider hidden sm:table-cell">Direção</th>
              <th className="text-left px-4 py-2.5 text-text-muted font-medium uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-2.5 text-text-muted font-medium uppercase tracking-wider hidden md:table-cell">URL</th>
              <th className="text-right px-4 py-2.5 text-text-muted font-medium uppercase tracking-wider">Quando</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-brand-border last:border-0">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 skeleton rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            )}
            {isError && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-status-error">
                  Erro ao carregar logs.
                </td>
              </tr>
            )}
            {!isLoading && !isError && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  Nenhum log registrado.
                </td>
              </tr>
            )}
            {!isLoading && !isError && rows.map((row) => (
              <tr key={row.id} className="border-b border-brand-border last:border-0 hover:bg-brand-surface-2 transition-colors">
                <td className="px-4 py-3 text-text-secondary capitalize">{row.channel}</td>
                <td className="px-4 py-3 text-text-muted hidden sm:table-cell capitalize">{row.direction}</td>
                <td className="px-4 py-3">
                  <span className={[
                    'px-1.5 py-0.5 rounded text-2xs font-medium',
                    row.status === 'success'
                      ? 'bg-status-success/10 text-status-success'
                      : 'bg-status-error/10 text-status-error',
                  ].join(' ')}>
                    {row.status === 'success' ? 'OK' : `Falha${row.httpStatus ? ` ${row.httpStatus}` : ''}`}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-muted hidden md:table-cell">
                  <span className="truncate max-w-[200px] block">{row.targetUrl ?? '—'}</span>
                </td>
                <td className="px-4 py-3 text-text-muted text-right whitespace-nowrap">
                  {formatRelativeTime(row.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-brand-border">
            <p className="text-xs text-text-muted">{data?.total ?? 0} registros</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={13} />
              </Button>
              <span className="text-xs text-text-secondary">{page} / {totalPages}</span>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight size={13} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
