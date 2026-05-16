'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrialUpgradeModalProps {
  slug: string;
  daysLeft: number;
  onClose?: () => void;
}

/**
 * Modal que aparece quando o trial está próximo de expirar (< 3 dias).
 * Também aparece quando já expirou.
 */
export function TrialUpgradeModal({ slug, daysLeft, onClose }: TrialUpgradeModalProps) {
  const hasExpired = daysLeft <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            hasExpired
              ? 'bg-status-error-muted'
              : 'bg-status-warning-muted',
          )}>
            {hasExpired ? (
              <AlertTriangle size={18} className="text-status-error" />
            ) : (
              <AlertTriangle size={18} className="text-status-warning" />
            )}
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              {hasExpired
                ? 'Trial expirado'
                : `Trial vence em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}`}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {hasExpired
                ? 'Escolha um plano para continuar usando a Nexora'
                : 'Escolha seu plano antes que o acesso seja bloqueado'}
            </p>
          </div>
        </div>

        {/* Benefits list */}
        <div className="rounded-lg border border-brand-border bg-brand-surface-2/40 p-4 mb-6">
          <p className="text-xs font-semibold text-text-muted uppercase mb-3">
            Ao escolher um plano, você obtém:
          </p>
          <ul className="space-y-2">
            {[
              'Recuperação ilimitada de clientes',
              'IA personalizada em mensagens',
              'WhatsApp + Email',
              'Suporte prioritário',
            ].map((benefit, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                <CheckCircle2 size={12} className="text-brand-gold shrink-0" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-3">
          <Link
            href={`/${slug}/settings/billing`}
            className="w-full inline-flex items-center justify-center bg-brand-gold text-brand-bg font-semibold px-4 py-3 rounded-lg hover:bg-brand-gold/90 active:scale-[0.98] transition-all"
          >
            Ver planos
          </Link>
          {!hasExpired && (
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 border border-brand-border bg-brand-surface-2 text-text-secondary rounded-lg hover:bg-brand-surface-3 transition-colors text-sm font-medium"
            >
              Fechar
            </button>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-text-muted mt-4">
          Dúvidas? <a href="mailto:support@nexora.com.br" className="text-brand-gold hover:underline">
            Entre em contato
          </a>
        </p>
      </div>
    </div>
  );
}
