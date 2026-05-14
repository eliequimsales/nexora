'use client';

import { Flame, ArrowRight, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface RecoveryHeroProps {
  inactiveCount: number;
  potentialRevenue: number;
  onRecoverAll: () => void;
  isLoading?: boolean;
}

/**
 * Hero card for the /clientes page — the "money on the table" moment.
 *
 * Sells the product inside the product:
 *  - big count → loss aversion
 *  - potential revenue → quantified opportunity
 *  - CTA → one click to action
 */
export function RecoveryHero({
  inactiveCount,
  potentialRevenue,
  onRecoverAll,
  isLoading = false,
}: RecoveryHeroProps) {
  const hasInactive = inactiveCount > 0;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-brand-purple/30 p-6 sm:p-8"
      style={{
        background:
          'linear-gradient(135deg, #7C3AED 0%, #6D28D9 60%, #4C1D95 100%)',
      }}
    >
      {/* Subtle decorative glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, #EAB308 0%, transparent 70%)' }}
      />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-2xs font-medium text-white/90 backdrop-blur-sm">
            <Sparkles size={11} className="text-brand-gold" />
            Nexora monitora 24/7
          </div>

          <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight flex items-center gap-2 flex-wrap">
            <Flame size={28} className="text-brand-gold shrink-0" />
            <span>
              Você tem{' '}
              <span className="text-brand-gold">
                {isLoading ? '…' : inactiveCount}
              </span>{' '}
              {inactiveCount === 1 ? 'cliente que sumiu' : 'clientes que sumiram'}
            </span>
          </h1>

          <p className="mt-3 text-sm sm:text-base text-white/80">
            Potencial de recuperação:{' '}
            <span className="font-semibold text-white">
              {isLoading ? '—' : formatCurrency(potentialRevenue)}
            </span>
          </p>

          <p className="mt-1 text-xs text-white/60">
            Cada dia parado é receita perdida. A Nexora gera uma mensagem
            personalizada para cada cliente e dispara via WhatsApp.
          </p>
        </div>

        <button
          type="button"
          onClick={onRecoverAll}
          disabled={!hasInactive || isLoading}
          className="group inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-5 py-3.5 text-sm sm:text-base font-bold text-brand-bg shadow-glow-amber transition-all hover:bg-brand-gold/90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
        >
          Recuperar todos com Nexora
          <ArrowRight
            size={18}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </button>
      </div>
    </div>
  );
}
