'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUpdateOrg } from '@/lib/hooks/org/useUpdateOrg';
import type { OrgResponse } from '@/types';

const schema = z.object({
  name: z.string().max(50).optional(),
  tone: z.enum(['formal', 'casual', 'friendly']).optional(),
  style: z.enum(['concise', 'detailed', 'empathetic']).optional(),
});

type FormData = z.infer<typeof schema>;

interface AssistantPersonaFormProps {
  org: OrgResponse;
}

export function AssistantPersonaForm({ org }: AssistantPersonaFormProps) {
  const updateOrg = useUpdateOrg();
  const persona = org.settings.assistant;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: persona?.name ?? '',
      tone: persona?.tone ?? 'casual',
      style: persona?.style ?? 'concise',
    },
  });

  useEffect(() => {
    reset({
      name: persona?.name ?? '',
      tone: persona?.tone ?? 'casual',
      style: persona?.style ?? 'concise',
    });
  }, [org, reset, persona]);

  async function onSubmit(data: FormData) {
    await updateOrg.mutateAsync({
      settings: {
        assistant: {
          name: data.name || undefined,
          tone: data.tone,
          style: data.style,
        },
      },
    });
    reset(data);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <Input
        label="Remetente das mensagens (opcional)"
        placeholder="Ex: João da Barbearia, Barbearia Silva"
        iconLeft={<Bot size={15} />}
        helper="Como a IA assina as mensagens. Deixe em branco para usar o nome da barbearia."
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
        {errors.tone && <p className="text-xs text-status-error">{errors.tone.message}</p>}
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
        {errors.style && <p className="text-xs text-status-error">{errors.style.message}</p>}
      </div>

      <div className="pt-2 flex justify-end">
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={isSubmitting || updateOrg.isPending}
          disabled={!isDirty}
        >
          Salvar persona
        </Button>
      </div>
    </form>
  );
}
