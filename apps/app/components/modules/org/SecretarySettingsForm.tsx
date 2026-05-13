'use client';

import { Bot, AlertCircle } from 'lucide-react';
import { useUpdateOrg } from '@/lib/hooks/org/useUpdateOrg';
import { cn } from '@/lib/utils';
import type { OrgResponse } from '@/types';

interface SecretarySettingsFormProps {
  org: OrgResponse;
}

export function SecretarySettingsForm({ org }: SecretarySettingsFormProps) {
  const updateOrg = useUpdateOrg();
  const enabled = org.settings.secretary?.enabled ?? false;

  async function handleToggle() {
    await updateOrg.mutateAsync({
      settings: { secretary: { enabled: !enabled } },
    });
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleToggle}
        disabled={updateOrg.isPending}
        className={cn(
          'w-full flex items-center justify-between rounded-xl border p-4 text-left transition-colors cursor-pointer',
          enabled
            ? 'border-brand-amber/40 bg-brand-amber/5'
            : 'border-brand-border bg-brand-surface hover:border-brand-border-2',
          updateOrg.isPending && 'opacity-60 pointer-events-none',
        )}
      >
        <div className="flex items-start gap-3">
          <span className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            enabled ? 'bg-brand-amber/10' : 'bg-brand-surface-2',
          )}>
            <Bot size={15} className={enabled ? 'text-brand-amber' : 'text-text-muted'} />
          </span>
          <div>
            <p className="text-sm font-medium text-text-primary leading-tight">
              Secretária operacional
            </p>
            <p className="text-2xs text-text-muted mt-0.5">
              Classifica novos leads automaticamente e gera um briefing para o time.
            </p>
          </div>
        </div>

        {/* Toggle pill */}
        <span className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200',
          enabled ? 'bg-brand-amber' : 'bg-brand-surface-2 border border-brand-border',
        )}>
          <span className={cn(
            'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200',
            enabled ? 'translate-x-4' : 'translate-x-0.5',
          )} />
        </span>
      </button>

      {enabled && (
        <div className="flex gap-2.5 rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2.5">
          <AlertCircle size={13} className="text-text-muted shrink-0 mt-0.5" />
          <p className="text-2xs text-text-muted leading-relaxed">
            Requer o prompt de classificação configurado em{' '}
            <strong className="text-text-secondary">Configurações → IA</strong>.
            Sem ele, a secretária reconhece os leads mas não classifica.
          </p>
        </div>
      )}
    </div>
  );
}
