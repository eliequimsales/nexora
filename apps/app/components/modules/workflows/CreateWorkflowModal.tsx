'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCreateWorkflow } from '@/lib/hooks/workflows/useCreateWorkflow';
import { usePipelineBoard } from '@/lib/hooks/pipeline/usePipelineBoard';
import { TRIGGER_LABELS, ACTION_LABELS } from '@/types';
import type { TriggerType, ActionType } from '@/types';

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(150),
  triggerType: z.enum([
    'lead_created', 'lead_status_changed', 'lead_stage_changed', 'lead_classified',
  ]),
  actionType: z.enum([
    'ai_classify', 'ai_respond', 'ai_follow_up', 'create_task', 'move_stage', 'update_status',
  ]),
  // create_task config
  taskTitle: z.string().max(200).optional(),
  taskDueDays: z.coerce.number().min(0).max(30).optional(),
  // update_status config
  targetStatus: z.string().optional(),
  // move_stage config (W2)
  targetStageId: z.string().optional(),
  // lead_status_changed condition
  toStatus: z.string().optional(),
  // lead_classified condition
  classification: z.string().optional(),
  // lead_stage_changed conditions (W3)
  fromStageId: z.string().optional(),
  toStageId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CreateWorkflowModalProps {
  onClose: () => void;
}

const SELECT_CLASS =
  'h-9 w-full rounded-lg bg-brand-surface-2 border border-brand-border text-sm text-text-primary px-3 focus:outline-none focus:ring-2 focus:ring-brand-amber/15 focus:border-brand-amber/60 transition-colors';

export function CreateWorkflowModal({ onClose }: CreateWorkflowModalProps) {
  const { mutate, isPending } = useCreateWorkflow();
  const { data: board } = usePipelineBoard();
  const stages = board?.stages ?? [];

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { triggerType: 'lead_created', actionType: 'ai_classify' },
  });

  const triggerType = watch('triggerType') as TriggerType;
  const actionType = watch('actionType') as ActionType;

  function onSubmit(data: FormData) {
    const triggerConditions: Record<string, unknown> = {};
    if (triggerType === 'lead_status_changed' && data.toStatus) {
      triggerConditions.toStatus = data.toStatus;
    }
    if (triggerType === 'lead_classified' && data.classification) {
      triggerConditions.classification = data.classification;
    }
    if (triggerType === 'lead_stage_changed') {
      if (data.fromStageId) triggerConditions.fromStageId = data.fromStageId;
      if (data.toStageId) triggerConditions.toStageId = data.toStageId;
    }

    const actionConfig: Record<string, unknown> = {};
    if (actionType === 'create_task') {
      actionConfig.title = data.taskTitle || 'Tarefa automática';
      actionConfig.dueDaysFromNow = data.taskDueDays ?? 1;
    }
    if (actionType === 'update_status') {
      actionConfig.targetStatus = data.targetStatus || 'contacted';
    }
    if (actionType === 'move_stage' && data.targetStageId) {
      actionConfig.targetStageId = data.targetStageId;
    }

    mutate({
      name: data.name,
      triggerType: data.triggerType,
      triggerConditions,
      actionType: data.actionType,
      actionConfig,
    }, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-text-primary">Novo workflow</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-brand-surface-2 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Input
            label="Nome"
            placeholder="Ex: Classificar lead novo"
            required
            error={errors.name?.message}
            {...register('name')}
          />

          {/* Trigger */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-secondary">Gatilho</label>
            <select {...register('triggerType')} className={SELECT_CLASS}>
              {(Object.entries(TRIGGER_LABELS) as [TriggerType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Condition: lead_status_changed */}
          {triggerType === 'lead_status_changed' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">Novo status (opcional)</label>
              <select {...register('toStatus')} className={SELECT_CLASS}>
                <option value="">Qualquer status</option>
                <option value="contacted">Contactado</option>
                <option value="qualified">Qualificado</option>
                <option value="disqualified">Descartado</option>
                <option value="closed_won">Ganho</option>
                <option value="closed_lost">Perdido</option>
              </select>
            </div>
          )}

          {/* Condition: lead_classified */}
          {triggerType === 'lead_classified' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">Classificação (opcional)</label>
              <select {...register('classification')} className={SELECT_CLASS}>
                <option value="">Qualquer classificação</option>
                <option value="hot">Quente</option>
                <option value="warm">Morno</option>
                <option value="cold">Frio</option>
              </select>
            </div>
          )}

          {/* Conditions: lead_stage_changed (W3) */}
          {triggerType === 'lead_stage_changed' && (
            <div className="space-y-3 p-3 rounded-lg bg-brand-surface-2 border border-brand-border">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-secondary">Estágio de origem (opcional)</label>
                <select {...register('fromStageId')} className={SELECT_CLASS}>
                  <option value="">Qualquer estágio</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-secondary">Estágio de destino (opcional)</label>
                <select {...register('toStageId')} className={SELECT_CLASS}>
                  <option value="">Qualquer estágio</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Action */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-secondary">Ação</label>
            <select {...register('actionType')} className={SELECT_CLASS}>
              {(Object.entries(ACTION_LABELS) as [ActionType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Action config: create_task */}
          {actionType === 'create_task' && (
            <div className="space-y-3 p-3 rounded-lg bg-brand-surface-2 border border-brand-border">
              <Input
                label="Título da tarefa"
                placeholder="Ex: Entrar em contato"
                {...register('taskTitle')}
              />
              <Input
                label="Prazo (dias)"
                type="number"
                placeholder="1"
                {...register('taskDueDays')}
              />
            </div>
          )}

          {/* Action config: update_status */}
          {actionType === 'update_status' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">Novo status do lead</label>
              <select {...register('targetStatus')} className={SELECT_CLASS}>
                <option value="contacted">Contactado</option>
                <option value="qualified">Qualificado</option>
                <option value="disqualified">Descartado</option>
                <option value="closed_won">Ganho</option>
                <option value="closed_lost">Perdido</option>
              </select>
            </div>
          )}

          {/* Action config: move_stage (W2) */}
          {actionType === 'move_stage' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">Estágio de destino</label>
              <select {...register('targetStageId')} className={SELECT_CLASS}>
                <option value="">Selecione um estágio</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="lg" className="flex-1" loading={isPending}>
              {isPending ? 'Criando...' : 'Criar workflow'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
