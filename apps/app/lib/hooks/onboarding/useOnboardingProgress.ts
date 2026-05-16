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

  // Onboarding simplificado para Nexora (modo recuperação de clientes — nicho barbearia)
  const isNexora = org.niche === 'barbearia';

  let steps: OnboardingStep[];

  if (isNexora) {
    // Nexora: 4 passos minimalistas para ir ao ar rápido
    steps = [
      {
        id: 'whatsapp',
        label: 'Conectar WhatsApp',
        description: 'Configure Z-API para enviar mensagens de recuperação via WhatsApp.',
        completed: Boolean(org.settings?.integrations?.zapiApiKey),
        href: `/${org.slug}/settings/integrations`,
      },
      {
        id: 'import_clients',
        label: 'Importar clientes',
        description: 'Carregue sua lista de clientes (CSV ou manual).',
        completed: (summary?.leads.total ?? 0) > 0,
        href: `/${org.slug}/leads`,
      },
      {
        id: 'inactivity_threshold',
        label: 'Configurar limite de inatividade',
        description: 'Defina após quantos dias um cliente é considerado perdido (padrão: 30).',
        completed: Boolean(org.settings?.nexora?.inactivityDays),
        href: `/${org.slug}/settings`,
      },
      {
        id: 'first_recovery',
        label: 'Primeira recuperação',
        description: 'Envie uma mensagem para seu primeiro cliente perdido.',
        completed: (summary?.leads?.hot ?? 0) > 0 || false,
        href: `/${org.slug}/clientes`,
      },
    ];
  } else {
    // Onboarding padrão genérico
    steps = [
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
  }

  const allDone = steps.every((s) => s.completed);

  return { steps, allDone, dismissed, isLoading: false };
}
