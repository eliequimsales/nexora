'use client';

import { useState } from 'react';
import { Plus, Trash2, Loader2, Copy, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useWebhooks } from '@/lib/hooks/integrations/useWebhooks';
import { useCreateWebhook } from '@/lib/hooks/integrations/useCreateWebhook';
import { useDeleteWebhook } from '@/lib/hooks/integrations/useDeleteWebhook';
import type { OutboundWebhook } from '@/types';

const ALL_EVENTS = [
  { value: 'lead.created', label: 'Lead criado' },
  { value: 'lead.status_changed', label: 'Status do lead alterado' },
  { value: 'proposal.accepted', label: 'Proposta aceita' },
  { value: 'proposal.rejected', label: 'Proposta recusada' },
];

function SecretDisplay({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="mt-2 flex items-center gap-2 bg-brand-surface-2 border border-brand-border rounded-lg px-3 py-2">
      <code className="text-xs text-text-secondary flex-1 truncate">{secret}</code>
      <button onClick={copy} className="text-text-muted hover:text-text-primary transition-colors">
        {copied ? <CheckCheck size={13} className="text-status-success" /> : <Copy size={13} />}
      </button>
    </div>
  );
}

function WebhookRow({ webhook, onDelete }: { webhook: OutboundWebhook; onDelete: () => void }) {
  return (
    <div className="py-3 border-b border-brand-border last:border-0">
      <div className="flex items-start gap-3">
        <div className={['w-2 h-2 rounded-full mt-1.5 shrink-0', webhook.isActive ? 'bg-status-success' : 'bg-brand-border'].join(' ')} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary font-medium truncate">{webhook.url}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {webhook.events.map((e) => (
              <span key={e} className="text-2xs bg-brand-surface-2 border border-brand-border rounded px-1.5 py-0.5 text-text-muted">
                {e}
              </span>
            ))}
          </div>
          {webhook.signingSecret && (
            <>
              <p className="text-xs text-text-muted mt-2">Guarde o signing secret — não será exibido novamente:</p>
              <SecretDisplay secret={webhook.signingSecret} />
            </>
          )}
        </div>
        <button
          onClick={onDelete}
          className="text-text-muted hover:text-status-error transition-colors shrink-0 mt-0.5"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function AddWebhookForm({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const { mutate, isPending } = useCreateWebhook();

  function toggleEvent(e: string) {
    setEvents((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);
  }

  function handleCreate() {
    if (!url || events.length === 0) return;
    mutate({ url, events }, { onSuccess: onClose });
  }

  return (
    <div className="border border-brand-border rounded-xl p-4 bg-brand-surface-2 mt-3 space-y-3">
      <div>
        <label className="text-xs font-medium text-text-secondary block mb-1">URL de destino</label>
        <input
          className="w-full px-3 py-2 rounded-lg border border-brand-border bg-brand-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-amber/40"
          placeholder="https://meusite.com/webhook"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      <div>
        <p className="text-xs font-medium text-text-secondary mb-1.5">Eventos</p>
        <div className="grid grid-cols-2 gap-1.5">
          {ALL_EVENTS.map((ev) => (
            <label key={ev.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-brand-amber"
                checked={events.includes(ev.value)}
                onChange={() => toggleEvent(ev.value)}
              />
              <span className="text-xs text-text-secondary">{ev.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleCreate} disabled={isPending || !url || events.length === 0}>
          {isPending ? <Loader2 size={13} className="animate-spin mr-1.5" /> : null}
          Criar webhook
        </Button>
      </div>
    </div>
  );
}

export function WebhookList() {
  const { data: webhooks = [], isLoading } = useWebhooks();
  const { mutate: del } = useDeleteWebhook();
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">Webhooks de saída</p>
          <p className="text-xs text-text-muted">Notifique sistemas externos em tempo real</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={adding}>
          <Plus size={13} className="mr-1" />
          Novo
        </Button>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-8 skeleton w-full rounded-lg" />)}
          </div>
        )}

        {!isLoading && webhooks.length === 0 && !adding && (
          <p className="text-sm text-text-muted text-center py-4">Nenhum webhook configurado.</p>
        )}

        {!isLoading && webhooks.map((wh) => (
          <WebhookRow key={wh.id} webhook={wh} onDelete={() => del(wh.id)} />
        ))}

        {adding && <AddWebhookForm onClose={() => setAdding(false)} />}
      </div>
    </div>
  );
}
