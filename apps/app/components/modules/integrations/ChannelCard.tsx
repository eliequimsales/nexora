'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, Power } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useSaveConfig } from '@/lib/hooks/integrations/useSaveConfig';
import { useToggleConfig } from '@/lib/hooks/integrations/useToggleConfig';
import { integrationsApi } from '@/lib/api/integrations.api';
import type { IntegrationConfig } from '@/types';

interface Field {
  key: string;
  label: string;
  type?: 'text' | 'password' | 'number';
  placeholder?: string | ((existing: unknown) => string);
}

const CHANNEL_META: Record<string, { label: string; fields: Field[] }> = {
  email: {
    label: 'E-mail (SMTP)',
    fields: [
      { key: 'host', label: 'Host SMTP', placeholder: 'smtp.exemplo.com' },
      { key: 'port', label: 'Porta', type: 'number', placeholder: '587' },
      { key: 'user', label: 'Usuário', placeholder: 'usuario@exemplo.com' },
      { key: 'password', label: 'Senha', type: 'password', placeholder: existing => existing ? '••••••••' : 'Senha SMTP' },
      { key: 'from', label: 'Remetente (opcional)', placeholder: 'B\'reshit <no-reply@exemplo.com>' },
    ],
  },
  whatsapp: {
    label: 'WhatsApp — Envio automático',
    fields: [
      { key: 'apiUrl', label: 'URL da Evolution API', placeholder: 'https://api.evolution.example.com' },
      { key: 'instance', label: 'Instância', placeholder: 'minha-instancia' },
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: existing => existing ? '••••••••' : 'Chave de API' },
    ],
  },
};

interface Props {
  channel: 'email' | 'whatsapp';
  existing?: IntegrationConfig;
}

export function ChannelCard({ channel, existing }: Props) {
  const meta = CHANNEL_META[channel];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const { mutate: save, isPending } = useSaveConfig();
  const { mutate: toggle, isPending: isToggling } = useToggleConfig();

  function handleSave() {
    const config: Record<string, unknown> = {};
    meta.fields.forEach(({ key, type }) => {
      const v = form[key];
      if (v !== undefined && v !== '') {
        config[key] = type === 'number' ? Number(v) : v;
      } else if (existing?.fields[key] !== undefined) {
        config[key] = existing.fields[key];
      }
    });

    save(
      { channel, config, isActive: true },
      { onSuccess: () => { setOpen(false); setForm({}); } },
    );
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await integrationsApi.testChannel(channel);
      setTestResult(res.data);
    } catch {
      setTestResult({ ok: false, error: 'Falha na requisição' });
    } finally {
      setTesting(false);
    }
  }

  const isConfigured = !!existing;

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface">
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className={[
            'w-2 h-2 rounded-full',
            isConfigured && existing?.isActive ? 'bg-status-success' : 'bg-brand-border',
          ].join(' ')} />
          <div>
            <p className="text-sm font-medium text-text-primary">{meta.label}</p>
            <p className="text-xs text-text-muted">
              {isConfigured ? (existing?.isActive ? 'Configurado e ativo' : 'Configurado, inativo') : 'Não configurado'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConfigured && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleTest(); }}
                disabled={testing || isToggling}
              >
                {testing ? <Loader2 size={13} className="animate-spin" /> : 'Testar'}
              </Button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggle({ channel, isActive: !existing?.isActive });
                }}
                disabled={isToggling}
                title={existing?.isActive ? 'Desativar canal' : 'Ativar canal'}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-brand-surface-2 transition-colors disabled:opacity-50"
              >
                {isToggling
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Power size={13} className={existing?.isActive ? 'text-status-success' : 'text-text-muted'} />
                }
              </button>
            </>
          )}
          {open ? <ChevronUp size={15} className="text-text-muted" /> : <ChevronDown size={15} className="text-text-muted" />}
        </div>
      </div>

      {testResult && (
        <div className={[
          'mx-4 mb-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg',
          testResult.ok ? 'text-status-success bg-status-success/10' : 'text-status-error bg-status-error/10',
        ].join(' ')}>
          {testResult.ok
            ? <><CheckCircle2 size={13} /> Conexão OK</>
            : <><XCircle size={13} /> {testResult.error ?? 'Falha'}</>
          }
        </div>
      )}

      {open && (
        <div className="px-4 pb-4 border-t border-brand-border pt-4 space-y-3">
          {meta.fields.map((field) => {
            const savedValue = existing?.fields[field.key];
            const ph = typeof field.placeholder === 'function'
              ? field.placeholder(savedValue)
              : (savedValue ? (field.type === 'password' ? '••••••••' : String(savedValue)) : (field.placeholder ?? ''));

            return (
              <div key={field.key}>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  {field.label}
                </label>
                <input
                  type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border bg-brand-surface-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-amber/40"
                  placeholder={ph}
                  value={form[field.key] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                />
              </div>
            );
          })}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setForm({}); }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? <Loader2 size={13} className="animate-spin mr-1.5" /> : null}
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
