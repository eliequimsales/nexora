'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { useCreateLead } from '@/lib/hooks/leads/useCreateLead';

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(120),
  phone: z.string().max(30).optional(),
  notes: z.string().max(500, 'Máximo 500 caracteres').optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
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
  });

  function onSubmit(data: FormData) {
    mutate(
      {
        name: data.name,
        phone: data.phone || undefined,
        notes: data.notes?.trim() || undefined,
        email: data.email || undefined,
        source: 'manual',
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
          <h2 className="text-base font-semibold text-text-primary">Adicionar cliente</h2>
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
            placeholder="Nome do cliente"
            required
            error={errors.name?.message}
            {...register('name')}
          />

          <Input
            label="WhatsApp"
            type="tel"
            placeholder="+55 11 99999-9999"
            error={errors.phone?.message}
            {...register('phone')}
          />

          <Textarea
            label="Observação"
            rows={3}
            placeholder="Algo que ajude a lembrar dessa pessoa"
            helper="Opcional"
            error={errors.notes?.message}
            {...register('notes')}
          />

          <Input
            label="Email"
            type="email"
            placeholder="email@exemplo.com"
            helper="Opcional"
            error={errors.email?.message}
            {...register('email')}
          />

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
              {isPending ? 'Adicionando...' : 'Adicionar cliente'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
