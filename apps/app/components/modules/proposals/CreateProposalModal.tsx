'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCreateProposal } from '@/lib/hooks/proposals/useCreateProposal';
import { useLeadsQuery } from '@/lib/hooks/leads/useLeadsQuery';

const itemSchema = z.object({
  description: z.string().min(1, 'Obrigatório').max(500),
  quantity: z.coerce.number().min(0.001, 'Mín. 0,001'),
  unitPrice: z.coerce.number().min(0, 'Mín. 0'),
});

const schema = z.object({
  leadId: z.string().uuid('Selecione um lead'),
  title: z.string().min(2, 'Mínimo 2 caracteres').max(255),
  note: z.string().max(5000).optional(),
  validUntil: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Adicione ao menos um item'),
});

type FormData = z.infer<typeof schema>;

function formatCurrency(value: number): string {
  if (isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface CreateProposalModalProps {
  leadId?: string;
  onClose: () => void;
}

export function CreateProposalModal({ leadId, onClose }: CreateProposalModalProps) {
  const { mutate, isPending } = useCreateProposal();
  const { data: leadsData } = useLeadsQuery({ limit: 100 });
  const leads = leadsData?.data ?? [];

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      leadId: leadId ?? '',
      title: '',
      items: [{ description: '', quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');

  const total = watchedItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );

  function onSubmit(data: FormData) {
    mutate(
      {
        leadId: data.leadId,
        title: data.title,
        note: data.note || undefined,
        validUntil: data.validUntil || undefined,
        items: data.items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      },
      { onSuccess: onClose },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-brand-border bg-brand-surface shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border shrink-0">
          <h2 className="text-base font-semibold text-text-primary">Nova proposta</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-brand-surface-2 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            {/* Lead + Título */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-secondary">Lead *</label>
                <select
                  {...register('leadId')}
                  disabled={!!leadId}
                  className="h-9 rounded-lg bg-brand-surface-2 border border-brand-border text-sm text-text-primary px-3 focus:outline-none focus:ring-2 focus:ring-brand-amber/15 focus:border-brand-amber/60 transition-colors disabled:opacity-50"
                >
                  <option value="">Selecione...</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                {errors.leadId && (
                  <p className="text-xs text-status-error">{errors.leadId.message}</p>
                )}
              </div>

              <Input
                label="Título *"
                placeholder="Ex: Proposta Comercial"
                error={errors.title?.message}
                {...register('title')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-secondary">Validade</label>
                <input
                  type="date"
                  {...register('validUntil')}
                  className="h-9 rounded-lg bg-brand-surface-2 border border-brand-border text-sm text-text-primary px-3 focus:outline-none focus:ring-2 focus:ring-brand-amber/15 focus:border-brand-amber/60 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-secondary">Observação</label>
                <textarea
                  {...register('note')}
                  placeholder="Condições, prazo de entrega, etc."
                  rows={2}
                  className="rounded-lg bg-brand-surface-2 border border-brand-border text-sm text-text-primary px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-amber/15 focus:border-brand-amber/60 transition-colors"
                />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-text-secondary">Itens</p>
                <button
                  type="button"
                  onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
                  className="flex items-center gap-1 text-xs text-brand-amber hover:text-brand-amber/80 transition-colors"
                >
                  <Plus size={12} />
                  Adicionar item
                </button>
              </div>

              {errors.items?.root && (
                <p className="text-xs text-status-error mb-2">{errors.items.root.message}</p>
              )}

              <div className="space-y-2">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_80px_100px_32px] gap-2 px-1">
                  <p className="text-2xs text-text-muted">Descrição</p>
                  <p className="text-2xs text-text-muted">Qtd.</p>
                  <p className="text-2xs text-text-muted">Valor unit.</p>
                  <span />
                </div>

                {fields.map((field, index) => {
                  const qty = Number(watchedItems[index]?.quantity) || 0;
                  const price = Number(watchedItems[index]?.unitPrice) || 0;
                  const lineTotal = qty * price;

                  return (
                    <div key={field.id} className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-start">
                      <div>
                        <input
                          {...register(`items.${index}.description`)}
                          placeholder="Descrição do item"
                          className="w-full h-8 rounded-lg bg-brand-surface-2 border border-brand-border text-sm text-text-primary px-2.5 focus:outline-none focus:ring-2 focus:ring-brand-amber/15 focus:border-brand-amber/60 transition-colors"
                        />
                        {errors.items?.[index]?.description && (
                          <p className="text-2xs text-status-error mt-0.5">
                            {errors.items[index].description?.message}
                          </p>
                        )}
                      </div>

                      <input
                        {...register(`items.${index}.quantity`)}
                        type="number"
                        step="0.001"
                        min="0.001"
                        className="h-8 rounded-lg bg-brand-surface-2 border border-brand-border text-sm text-text-primary px-2.5 focus:outline-none focus:ring-2 focus:ring-brand-amber/15 focus:border-brand-amber/60 transition-colors"
                      />

                      <div>
                        <input
                          {...register(`items.${index}.unitPrice`)}
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-full h-8 rounded-lg bg-brand-surface-2 border border-brand-border text-sm text-text-primary px-2.5 focus:outline-none focus:ring-2 focus:ring-brand-amber/15 focus:border-brand-amber/60 transition-colors"
                        />
                        {lineTotal > 0 && (
                          <p className="text-2xs text-text-muted mt-0.5 text-right">
                            {formatCurrency(lineTotal)}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => fields.length > 1 && remove(index)}
                        disabled={fields.length <= 1}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-text-muted hover:text-status-error hover:bg-status-error/10 transition-colors disabled:opacity-30"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-brand-border shrink-0 flex items-center justify-between gap-4">
            <div>
              <p className="text-2xs text-text-muted">Total</p>
              <p className="text-base font-semibold text-text-primary">{formatCurrency(total)}</p>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" size="lg" onClick={onClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" size="lg" loading={isPending}>
                {isPending ? 'Criando...' : 'Criar proposta'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
