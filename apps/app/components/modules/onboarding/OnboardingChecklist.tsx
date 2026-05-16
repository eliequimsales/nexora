'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, ChevronRight, Sparkles, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOnboardingProgress } from '@/lib/hooks/onboarding/useOnboardingProgress';
import { useUpdateOrg } from '@/lib/hooks/org/useUpdateOrg';
import { useOrgQuery } from '@/lib/hooks/org/useOrgQuery';

export function OnboardingChecklist() {
  const { steps, allDone, dismissed, isLoading } = useOnboardingProgress();
  const { data: org } = useOrgQuery();
  const updateOrg = useUpdateOrg();

  if (isLoading || dismissed) return null;

  const isNexora = org?.niche === 'barbearia';
  const completedCount = steps.filter((s) => s.completed).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  async function handleDismiss() {
    await updateOrg.mutateAsync({ settings: { onboarding: { dismissed: true } } });
  }

  return (
    <div className={cn(
      'rounded-xl border p-5 mb-6 transition-all duration-300',
      allDone
        ? isNexora
          ? 'border-brand-purple/40 bg-brand-purple/5'
          : 'border-brand-amber/40 bg-brand-amber/5'
        : 'border-brand-border bg-brand-surface',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg shrink-0',
            isNexora
              ? 'bg-brand-purple/10'
              : 'bg-brand-amber/10',
          )}>
            {isNexora ? (
              <Zap size={14} className="text-brand-purple" />
            ) : (
              <Sparkles size={14} className="text-brand-amber" />
            )}
          </span>
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {allDone
                ? isNexora
                  ? 'Nexora está pronta para recuperar clientes'
                  : 'Plataforma pronta para operar'
                : isNexora
                ? 'Ative a Nexora em 4 passos'
                : 'Configure sua plataforma'}
            </p>
            <p className="text-2xs text-text-muted mt-0.5">
              {allDone
                ? isNexora
                  ? 'Todos os passos concluídos. Comece a recuperar clientes!'
                  : 'Todos os passos concluídos. Sua IA está ativa.'
                : `${completedCount} de ${steps.length} passos concluídos`}
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-brand-surface-2 transition-colors shrink-0"
          aria-label="Dispensar"
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-brand-surface-2 mb-4 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-amber transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-1">
        {steps.map((step) => (
          <div
            key={step.id}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
              step.completed
                ? 'opacity-60'
                : 'bg-brand-surface-2',
            )}
          >
            {step.completed ? (
              <CheckCircle2 size={15} className="text-brand-amber shrink-0" />
            ) : (
              <Circle size={15} className="text-text-muted shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-xs font-medium leading-tight',
                step.completed ? 'text-text-muted line-through' : 'text-text-primary',
              )}>
                {step.label}
              </p>
              {!step.completed && (
                <p className="text-2xs text-text-muted mt-0.5 leading-relaxed">
                  {step.description}
                </p>
              )}
            </div>
            {!step.completed && step.href && (
              <Link
                href={step.href}
                className="flex items-center gap-1 text-2xs text-brand-amber hover:text-brand-amber/80 font-medium shrink-0 transition-colors"
              >
                Configurar
                <ChevronRight size={11} />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
