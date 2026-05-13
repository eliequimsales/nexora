'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  GitBranch,
  Zap,
  ArrowRight,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TemplateGrid } from '@/components/modules/templates/TemplateGrid';
import { useWizardState, WIZARD_TOTAL_STEPS } from '@/lib/hooks/onboarding/useWizardState';
import { useApplyTemplate } from '@/lib/hooks/templates/useApplyTemplate';
import { useUpdateOrg } from '@/lib/hooks/org/useUpdateOrg';
import { useCreateLead } from '@/lib/hooks/leads/useCreateLead';
import { useOrgQuery } from '@/lib/hooks/org/useOrgQuery';
import type { OrgResponse } from '@/types';

interface WizardModalProps {
  org: OrgResponse;
  userName: string;
}

const STEP_LABELS = [
  'Bem-vindo',
  'Escolha o nicho',
  'Confirmar',
  'Persona da IA',
  'Primeiro lead',
  'Concluído',
];

// ── Step 1: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ org, userName, onNext }: { org: OrgResponse; userName: string; onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-6 py-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-amber/10">
        <Sparkles size={28} className="text-brand-amber" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-text-primary mb-2">
          Bem-vindo à B&apos;reshit, {userName.split(' ')[0]}!
        </h2>
        <p className="text-sm text-text-muted max-w-sm">
          Vamos configurar <strong className="text-text-primary">{org.name}</strong> em menos de
          2 minutos. Você pode pular qualquer etapa e configurar depois.
        </p>
      </div>
      <Button variant="primary" size="lg" onClick={onNext} className="gap-2">
        Começar <ArrowRight size={15} />
      </Button>
    </div>
  );
}

// ── Step 2: Choose template ──────────────────────────────────────────────────

function StepChooseTemplate({ org, onNext, onSkip }: { org: OrgResponse; onNext: () => void; onSkip: () => void }) {
  const { data: freshOrg } = useOrgQuery();
  const displayOrg = freshOrg ?? org;
  const hasApplied = Boolean(displayOrg.settings?.appliedTemplate);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">Escolha um template</h2>
        <p className="text-sm text-text-muted">
          O template configura pipeline, automações e prompts de IA para o seu nicho.
        </p>
      </div>
      <TemplateGrid orgSettings={displayOrg.settings} />
      <div className="flex justify-between pt-2">
        <button
          onClick={onSkip}
          className="text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          Pular por agora
        </button>
        <Button
          variant="primary"
          size="md"
          onClick={onNext}
          disabled={!hasApplied}
          className="gap-2"
        >
          Continuar <ChevronRight size={15} />
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: Preview ──────────────────────────────────────────────────────────

function StepPreview({ org, onNext, onBack }: { org: OrgResponse; onNext: () => void; onBack: () => void }) {
  const { data: freshOrg } = useOrgQuery();
  const displayOrg = freshOrg ?? org;
  const applied = displayOrg.settings?.appliedTemplate;
  const applyTemplate = useApplyTemplate();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">O que foi configurado</h2>
        {applied ? (
          <p className="text-sm text-text-muted">
            Template <strong className="text-text-primary">{applied.id}</strong> aplicado em{' '}
            {new Date(applied.appliedAt).toLocaleDateString('pt-BR')}.
          </p>
        ) : (
          <p className="text-sm text-text-muted">Nenhum template aplicado ainda.</p>
        )}
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface-2 divide-y divide-brand-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <GitBranch size={15} className="text-brand-blue shrink-0" />
          <div>
            <p className="text-xs font-medium text-text-primary">Pipeline</p>
            <p className="text-2xs text-text-muted">Estágios configurados para o seu nicho</p>
          </div>
          {applied && <CheckCircle size={14} className="text-status-success ml-auto shrink-0" />}
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <Zap size={15} className="text-brand-amber shrink-0" />
          <div>
            <p className="text-xs font-medium text-text-primary">Automações</p>
            <p className="text-2xs text-text-muted">Workflows de classificação e resposta</p>
          </div>
          {applied && <CheckCircle size={14} className="text-status-success ml-auto shrink-0" />}
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <Bot size={15} className="text-brand-blue shrink-0" />
          <div>
            <p className="text-xs font-medium text-text-primary">Prompts de IA</p>
            <p className="text-2xs text-text-muted">Classificação, resposta e follow-up</p>
          </div>
          {applied && <CheckCircle size={14} className="text-status-success ml-auto shrink-0" />}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="secondary" size="md" onClick={onBack} className="gap-1">
          <ChevronLeft size={15} /> Voltar
        </Button>
        <Button variant="primary" size="md" onClick={onNext} disabled={applyTemplate.isPending} className="gap-2">
          Continuar <ChevronRight size={15} />
        </Button>
      </div>
    </div>
  );
}

// ── Step 4: Assistant persona ────────────────────────────────────────────────

const personaSchema = z.object({
  name: z.string().max(50).optional(),
  tone: z.enum(['formal', 'casual', 'friendly']).optional(),
  style: z.enum(['concise', 'detailed', 'empathetic']).optional(),
});
type PersonaForm = z.infer<typeof personaSchema>;

function StepPersona({ org, onNext, onBack, onSkip }: { org: OrgResponse; onNext: () => void; onBack: () => void; onSkip: () => void }) {
  const updateOrg = useUpdateOrg();
  const persona = org.settings.assistant;

  const { register, handleSubmit, formState: { errors, isDirty, isSubmitting } } = useForm<PersonaForm>({
    resolver: zodResolver(personaSchema),
    defaultValues: {
      name: persona?.name ?? '',
      tone: persona?.tone ?? 'formal',
      style: persona?.style ?? 'concise',
    },
  });

  async function onSubmit(data: PersonaForm) {
    await updateOrg.mutateAsync({
      settings: {
        assistant: { name: data.name || undefined, tone: data.tone, style: data.style },
      },
    });
    onNext();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">Persona da assistente</h2>
        <p className="text-sm text-text-muted">Como a IA se apresenta nas mensagens geradas.</p>
      </div>

      <Input
        label="Nome da assistente"
        placeholder="Ex: Sofia, Luna, Assistente"
        iconLeft={<Bot size={15} />}
        error={errors.name?.message}
        {...register('name')}
      />

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text-secondary">Tom de voz</label>
        <select
          {...register('tone')}
          className="w-full h-9 px-3 rounded-lg border border-brand-border bg-brand-surface-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-amber focus:border-brand-amber transition-colors appearance-none"
        >
          <option value="formal">Formal — profissional e direto</option>
          <option value="casual">Casual — descontraído e próximo</option>
          <option value="friendly">Amigável — caloroso e empático</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text-secondary">Estilo de resposta</label>
        <select
          {...register('style')}
          className="w-full h-9 px-3 rounded-lg border border-brand-border bg-brand-surface-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-amber focus:border-brand-amber transition-colors appearance-none"
        >
          <option value="concise">Conciso — respostas curtas e objetivas</option>
          <option value="detailed">Detalhado — explicações completas</option>
          <option value="empathetic">Empático — foco em conexão emocional</option>
        </select>
      </div>

      <div className="flex justify-between pt-2">
        <div className="flex gap-2">
          <Button variant="secondary" size="md" type="button" onClick={onBack} className="gap-1">
            <ChevronLeft size={15} /> Voltar
          </Button>
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-text-muted hover:text-text-primary px-3 transition-colors"
          >
            Pular
          </button>
        </div>
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={isSubmitting || updateOrg.isPending}
          disabled={!isDirty}
          className="gap-2"
        >
          Salvar e continuar <ChevronRight size={15} />
        </Button>
      </div>
    </form>
  );
}

// ── Step 5: First lead ───────────────────────────────────────────────────────

const leadSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(120),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
});
type LeadForm = z.infer<typeof leadSchema>;

function StepFirstLead({ onNext, onBack, onSkip }: { onNext: () => void; onBack: () => void; onSkip: () => void }) {
  const createLead = useCreateLead();
  const [created, setCreated] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LeadForm>({
    resolver: zodResolver(leadSchema),
  });

  async function onSubmit(data: LeadForm) {
    await createLead.mutateAsync(
      { name: data.name, email: data.email || undefined, phone: data.phone || undefined, source: 'manual' },
    );
    setCreated(true);
    onNext();
  }

  if (created) return null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">Adicione seu primeiro lead</h2>
        <p className="text-sm text-text-muted">Opcional — você pode adicionar leads depois.</p>
      </div>

      <Input
        label="Nome"
        placeholder="Nome do lead"
        required
        error={errors.name?.message}
        {...register('name')}
      />
      <Input
        label="Email"
        type="email"
        placeholder="email@exemplo.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="Telefone"
        type="tel"
        placeholder="+55 11 99999-9999"
        error={errors.phone?.message}
        {...register('phone')}
      />

      <div className="flex justify-between pt-2">
        <div className="flex gap-2">
          <Button variant="secondary" size="md" type="button" onClick={onBack} className="gap-1">
            <ChevronLeft size={15} /> Voltar
          </Button>
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-text-muted hover:text-text-primary px-3 transition-colors"
          >
            Pular
          </button>
        </div>
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={isSubmitting || createLead.isPending}
          className="gap-2"
        >
          Criar e continuar <ChevronRight size={15} />
        </Button>
      </div>
    </form>
  );
}

// ── Step 6: Done ─────────────────────────────────────────────────────────────

function StepDone({ org, onClose }: { org: OrgResponse; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-6 py-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-status-success/10">
        <CheckCircle size={28} className="text-status-success" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-text-primary mb-2">
          {org.name} está pronto para operar!
        </h2>
        <p className="text-sm text-text-muted max-w-sm">
          Pipeline, automações e IA configurados. Você pode ajustar qualquer coisa em Configurações.
        </p>
      </div>
      <Button variant="primary" size="lg" onClick={onClose} className="gap-2">
        Ir para o Dashboard <ArrowRight size={15} />
      </Button>
    </div>
  );
}

// ── WizardModal ───────────────────────────────────────────────────────────────

export function WizardModal({ org, userName }: WizardModalProps) {
  const { step, next, back, complete, dismiss } = useWizardState(org);
  const { data: freshOrg } = useOrgQuery();
  const currentOrg = freshOrg ?? org;

  function handleClose() {
    complete();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop — not dismissible by clicking outside */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-xl rounded-2xl border border-brand-border bg-brand-surface shadow-2xl overflow-hidden">
        {/* Progress header */}
        <div className="px-6 pt-5 pb-4 border-b border-brand-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-text-muted">
              Passo {step} de {WIZARD_TOTAL_STEPS}
            </span>
            <span className="text-xs text-text-muted">{STEP_LABELS[step - 1]}</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: WIZARD_TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'flex-1 h-1 rounded-full transition-all duration-300',
                  i < step ? 'bg-brand-amber' : 'bg-brand-surface-2',
                )}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="p-6">
          {step === 1 && (
            <StepWelcome org={currentOrg} userName={userName} onNext={next} />
          )}
          {step === 2 && (
            <StepChooseTemplate org={currentOrg} onNext={next} onSkip={next} />
          )}
          {step === 3 && (
            <StepPreview org={currentOrg} onNext={next} onBack={back} />
          )}
          {step === 4 && (
            <StepPersona org={currentOrg} onNext={next} onBack={back} onSkip={next} />
          )}
          {step === 5 && (
            <StepFirstLead onNext={next} onBack={back} onSkip={next} />
          )}
          {step === 6 && (
            <StepDone org={currentOrg} onClose={handleClose} />
          )}
        </div>

        {/* Footer skip — only on step 1 and 6 can't skip; step 6 is the done state */}
        {step > 1 && step < 6 && step !== 2 && step !== 4 && step !== 5 && (
          <div className="px-6 pb-4 -mt-2 flex justify-center">
            <button
              onClick={dismiss}
              className="text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              Configurar depois — fechar assistente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
