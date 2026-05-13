'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCreateTask } from '@/lib/hooks/tasks/useCreateTask';
import { useUsersQuery } from '@/lib/hooks/users/useUsersQuery';

const schema = z.object({
  title: z.string().min(2, 'Informe um título').max(500),
  dueDate: z.string().optional(),
  assignedTo: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CreateTaskModalProps {
  leadId: string;
  leadName: string;
  onClose: () => void;
}

export function CreateTaskModal({ leadId, leadName, onClose }: CreateTaskModalProps) {
  const { mutate: create, isPending } = useCreateTask();
  const { data: usersPage } = useUsersQuery();
  const users = usersPage?.data ?? [];
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  function onSubmit(data: FormData) {
    setServerError(null);
    create(
      {
        title: data.title,
        leadId,
        assignedTo: data.assignedTo || undefined,
        dueDate: data.dueDate || undefined,
      },
      {
        onSuccess: () => onClose(),
        onError: () => setServerError('Não foi possível criar a tarefa. Tente novamente.'),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-brand-border bg-brand-surface shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border">
          <div className="flex items-center gap-2.5">
            <ClipboardList size={16} className="text-brand-amber" />
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Nova tarefa</h2>
              <p className="text-xs text-text-muted">{leadName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-brand-surface-2 transition-colors"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <Input
            label="Título"
            placeholder="Ex: Enviar proposta até sexta"
            error={errors.title?.message}
            {...register('title')}
          />

          <Input
            label="Prazo"
            type="date"
            error={errors.dueDate?.message}
            {...register('dueDate')}
          />

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Responsável
            </label>
            <select
              {...register('assignedTo')}
              className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-amber/40"
            >
              <option value="">Sem responsável</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {serverError && (
            <p role="alert" className="text-xs text-status-error">
              {serverError}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" size="md" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="md" className="flex-1" loading={isPending}>
              Criar tarefa
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
