'use client';

import { Check } from 'lucide-react';

interface PlanCardProps {
  id: string;
  name: string;
  priceId: string;
  monthlyPrice: string;
  limits: { leadsPerMonth: number; aiExecPerMonth: number; maxUsers: number };
  isActive: boolean;
  onUpgrade: (priceId: string) => void;
  isLoading?: boolean;
}

export function PlanCard({
  name, priceId, monthlyPrice, limits, isActive, onUpgrade, isLoading,
}: PlanCardProps) {
  return (
    <div
      className={`rounded-xl border p-5 flex flex-col gap-4 ${
        isActive
          ? 'border-brand-amber bg-brand-amber/5'
          : 'border-brand-border bg-brand-surface'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text-primary capitalize">{name}</p>
          <p className="text-xs text-text-muted mt-0.5">{monthlyPrice}/mês</p>
        </div>
        {isActive && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-amber text-brand-bg">
            Plano atual
          </span>
        )}
      </div>

      <ul className="space-y-1.5 text-xs text-text-secondary">
        <li className="flex items-center gap-1.5">
          <Check size={12} className="text-brand-amber flex-shrink-0" />
          {limits.leadsPerMonth.toLocaleString()} leads/mês
        </li>
        <li className="flex items-center gap-1.5">
          <Check size={12} className="text-brand-amber flex-shrink-0" />
          {limits.aiExecPerMonth.toLocaleString()} execuções de IA/mês
        </li>
        <li className="flex items-center gap-1.5">
          <Check size={12} className="text-brand-amber flex-shrink-0" />
          Até {limits.maxUsers} usuários
        </li>
      </ul>

      {!isActive && (
        <button
          onClick={() => onUpgrade(priceId)}
          disabled={isLoading}
          className="w-full mt-auto rounded-lg bg-brand-amber text-brand-bg text-xs font-semibold py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isLoading ? 'Redirecionando...' : 'Fazer upgrade'}
        </button>
      )}
    </div>
  );
}
