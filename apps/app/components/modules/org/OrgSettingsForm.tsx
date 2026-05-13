'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Globe, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUpdateOrg } from '@/lib/hooks/org/useUpdateOrg';
import type { OrgResponse } from '@/types';

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(255),
  language: z.enum(['pt-BR', 'en-US']),
  timezone: z.string().max(100).optional(),
});

type FormData = z.infer<typeof schema>;

interface OrgSettingsFormProps {
  org: OrgResponse;
}

export function OrgSettingsForm({ org }: OrgSettingsFormProps) {
  const updateOrg = useUpdateOrg();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: org.name,
      language: org.settings.language ?? 'pt-BR',
      timezone: org.settings.timezone ?? '',
    },
  });

  // Sync form when org data refreshes from server
  useEffect(() => {
    reset({
      name: org.name,
      language: org.settings.language ?? 'pt-BR',
      timezone: org.settings.timezone ?? '',
    });
  }, [org, reset]);

  async function onSubmit(data: FormData) {
    await updateOrg.mutateAsync({
      name: data.name,
      settings: {
        language: data.language,
        timezone: data.timezone || undefined,
      },
    });
    reset(data); // clear dirty state after successful save
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <Input
        label="Nome da organização"
        placeholder="Minha Empresa"
        iconLeft={<Building2 size={15} />}
        error={errors.name?.message}
        {...register('name')}
      />

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text-secondary">
          Idioma
        </label>
        <div className="relative">
          <Globe
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <select
            {...register('language')}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-brand-border bg-brand-surface-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-amber focus:border-brand-amber transition-colors appearance-none"
          >
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en-US">English (US)</option>
          </select>
        </div>
        {errors.language && (
          <p className="text-xs text-status-error">{errors.language.message}</p>
        )}
      </div>

      <Input
        label="Fuso horário"
        placeholder="America/Sao_Paulo"
        iconLeft={<Clock size={15} />}
        helper="Ex: America/Sao_Paulo, America/New_York"
        error={errors.timezone?.message}
        {...register('timezone')}
      />

      <div className="pt-2 flex justify-end">
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={isSubmitting || updateOrg.isPending}
          disabled={!isDirty}
        >
          Salvar alterações
        </Button>
      </div>
    </form>
  );
}
