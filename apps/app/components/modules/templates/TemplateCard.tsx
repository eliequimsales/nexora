'use client';

import { useState } from 'react';
import { GitBranch, Zap, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApplyTemplate } from '@/lib/hooks/templates/useApplyTemplate';
import type { Template } from '@/types';

interface TemplateCardProps {
  template: Template;
  alreadyApplied?: boolean;
}

const NICHE_LABELS: Record<string, string> = {
  real_estate: 'Imobiliária',
  services: 'Serviços',
  ecommerce: 'E-commerce',
  barbearia: 'Barbearia',
  beauty_wellness: 'Beleza & Bem-estar',
};

export function TemplateCard({ template, alreadyApplied = false }: TemplateCardProps) {
  const [confirming, setConfirming] = useState(false);
  const apply = useApplyTemplate();

  function handleApply() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    apply.mutate(template.id, {
      onSettled: () => setConfirming(false),
    });
  }

  const nicheLabel = NICHE_LABELS[template.niche] ?? template.niche;

  return (
    <div className={cn(
      'rounded-xl border bg-brand-surface p-5 flex flex-col gap-4 transition-shadow hover:shadow-md',
      alreadyApplied ? 'border-brand-amber/40' : 'border-brand-border',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-amber/10 text-brand-amber">
              {nicheLabel}
            </span>
            {alreadyApplied && (
              <span className="flex items-center gap-1 text-xs text-status-success">
                <CheckCircle size={12} />
                Aplicado
              </span>
            )}
          </div>
          <h3 className="font-semibold text-text-primary text-base">{template.name}</h3>
          <p className="text-sm text-text-muted mt-1 line-clamp-2">{template.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <GitBranch size={13} className="text-brand-blue" />
          {template.pipelineStages.length} estágios
        </span>
        <span className="flex items-center gap-1.5">
          <Zap size={13} className="text-brand-amber" />
          {template.workflows.length} automações
        </span>
      </div>

      <div className="mt-auto">
        {confirming ? (
          <div className="flex items-center gap-2">
            <p className="text-xs text-text-muted flex-1">
              Esta ação não pode ser desfeita. Confirmar?
            </p>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs px-3 py-1.5 rounded-lg border border-brand-border text-text-muted hover:bg-brand-surface-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleApply}
              disabled={apply.isPending}
              className="text-xs px-3 py-1.5 rounded-lg bg-brand-amber text-white hover:bg-brand-amber/90 disabled:opacity-50 transition-colors"
            >
              {apply.isPending ? 'Aplicando…' : 'Confirmar'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleApply}
            disabled={apply.isPending}
            className="w-full text-sm px-4 py-2 rounded-lg border border-brand-border text-text-primary hover:bg-brand-surface-2 disabled:opacity-50 transition-colors"
          >
            Aplicar template
          </button>
        )}
      </div>
    </div>
  );
}
