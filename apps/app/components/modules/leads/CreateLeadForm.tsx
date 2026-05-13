'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCreateLead } from '@/lib/hooks/leads/useCreateLead';

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(120),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  source: z.enum(['manual', 'form', 'import', 'api']).optional(),
});

type FormData = z.infer<typeof schema>;

interface CreateLeadFormProps {
  onClose: () => void;
}

export function CreateLeadForm({ onClose }: CreateLeadFormProps) {
  const { mutate, isPending } = useCreateLead();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { source: 'manual' },
  });

  function onSubmit(data: FormData) {
    mutate(
      {
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        source: data.source,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-text-primary">Novo lead</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-brand-surface-2 transition-colors"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-secondary">Origem</label>
            <select
              {...register('source')}
              className="h-9 rounded-lg bg-brand-surface-2 border border-brand-border text-sm text-text-primary px-3 focus:outline-none focus:ring-2 focus:ring-brand-amber/15 focus:border-brand-amber/60 transition-colors"
            >
              <option value="manual">Manual</option>
              <option value="form">Formulário</option>
              <option value="import">Importação</option>
              <option value="api">API</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="flex-1"
              loading={isPending}
            >
              {isPending ? 'Criando...' : 'Criar lead'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
