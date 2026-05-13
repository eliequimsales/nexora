'use client';

import { X, Zap } from 'lucide-react';
import Link from 'next/link';
import { usePlanLimitStore } from '@/lib/stores/plan-limit.store';
import { useOrgQuery } from '@/lib/hooks/org/useOrgQuery';

const RESOURCE_LABELS: Record<string, string> = {
  leads: 'leads',
  aiExecutions: 'execuções de IA',
};

export function PlanLimitModal() {
  const { isOpen, resource, close } = usePlanLimitStore();
  const { data: org } = useOrgQuery();

  if (!isOpen) return null;

  const label = resource ? (RESOURCE_LABELS[resource] ?? resource) : 'recursos';
  const billingPath = org ? `/${org.slug}/settings/billing` : '/settings/billing';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-2xl">
        <button
          onClick={close}
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
        >
          <X size={16} />
        </button>

        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-amber/10 mb-4">
          <Zap size={18} className="text-brand-amber" />
        </div>

        <h2 className="text-base font-semibold text-text-primary mb-1">
          Limite do plano atingido
        </h2>
        <p className="text-sm text-text-secondary mb-5">
          Você atingiu o limite de {label} do seu plano atual. Faça upgrade para continuar.
        </p>

        <div className="flex flex-col gap-2">
          <Link
            href={billingPath}
            onClick={close}
            className="w-full rounded-lg bg-brand-amber text-brand-bg text-sm font-semibold py-2.5 text-center hover:opacity-90 transition-opacity"
          >
            Ver planos e fazer upgrade
          </Link>
          <button
            onClick={close}
            className="w-full rounded-lg border border-brand-border text-text-secondary text-sm py-2.5 hover:bg-brand-surface-2 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
