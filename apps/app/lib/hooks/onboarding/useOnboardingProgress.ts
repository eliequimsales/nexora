'use client';

import { useOrgQuery } from '@/lib/hooks/org/useOrgQuery';
import { useDashboardSummary } from '@/lib/hooks/dashboard/useDashboardSummary';

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  href?: string;
}

export function useOnboardingProgress() {
  const { data: org } = useOrgQuery();
  const { data: summary } = useDashboardSummary();

  if (!org) {
    return { steps: [] as OnboardingStep[], allDone: false, dismissed: false, isLoading: true };
  }

  const aiPrompts = (org as any).aiPrompts as Record<string, unknown> ?? {};
  const dismissed = org.settings?.onboarding?.dismissed === true;

  const steps: OnboardingStep[] = [
    {
      id: 'org',
      label: 'Organização criada',
      description: 'Sua conta está ativa e pronta para uso.',
      completed: true,
    },
    {
      id: 'ai_prompts',
      label: 'Configurar IA',
      description: 'Defina os prompts de classificação para ativar o módulo de IA.',
      completed: Boolean(aiPrompts?.classify),
      href: `/${org.slug}/settings`,
    },
    {
      id: 'persona',
      label: 'Definir persona da assistente',
      description: 'Configure o nome e o tom de voz da sua assistente.',
      completed: Boolean(org.settings?.assistant?.name),
      href: `/${org.slug}/settings`,
    },
    {
      id: 'first_lead',
      label: 'Adicionar primeiro lead',
      description: 'Capture seu primeiro lead para ver a plataforma em ação.',
      completed: (summary?.leads.total ?? 0) > 0,
      href: `/${org.slug}/leads`,
    },
  ];

  const allDone = steps.every((s) => s.completed);

  return { steps, allDone, dismissed, isLoading: false };
}
