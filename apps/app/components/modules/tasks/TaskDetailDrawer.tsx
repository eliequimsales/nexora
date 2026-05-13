'use client';

import { useState } from 'react';
import { X, Calendar, User, Tag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUpdateTask } from '@/lib/hooks/tasks/useUpdateTask';
import { useCompleteTask } from '@/lib/hooks/tasks/useCompleteTask';
import { useUsersQuery } from '@/lib/hooks/users/useUsersQuery';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Task, UpdateTaskPayload } from '@/types';
import { tasksApi } from '@/lib/api/tasks.api';
import { useQueryClient } from '@tanstack/react-query';
import { TASKS_QUERY_KEY } from '@/lib/hooks/tasks/useTasksQuery';
import { useToast } from '@/lib/providers/ToastProvider';

interface TaskDetailDrawerProps {
  task: Task;
  onClose: () => void;
}

export function TaskDetailDrawer({ task, onClose }: TaskDetailDrawerProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { mutate: update, isPending: isUpdating } = useUpdateTask(task.id);
  const { mutate: complete, isPending: isCompleting } = useCompleteTask();
  const { data: usersPage } = useUsersQuery();
  const users = usersPage?.data ?? [];
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isDone = task.status === 'done';

  async function handleDelete() {
    if (!confirm('Remover esta tarefa?')) return;
    setIsDeleting(true);
    try {
      await tasksApi.remove(task.id);
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
      toast({ variant: 'success', title: 'Tarefa removida' });
      onClose();
    } catch {
      toast({ variant: 'error', title: 'Erro ao remover tarefa' });
      setIsDeleting(false);
    }
  }

  function handleFieldUpdate(payload: UpdateTaskPayload) {
    update(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-sm bg-brand-surface border-l border-brand-border h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border shrink-0">
          <h2 className="text-sm font-semibold text-text-primary truncate pr-4">{task.title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-brand-surface-2 transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Status */}
          <div>
            <p className="text-xs font-medium text-text-muted mb-2">Status</p>
            <button
              onClick={() => {
                if (isDone) {
                  update({ status: 'pending' });
                } else {
                  complete(task.id);
                }
              }}
              disabled={isUpdating || isCompleting}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                isDone
                  ? 'bg-status-success/10 text-status-success border-status-success/20'
                  : 'bg-brand-surface-2 text-text-secondary border-brand-border hover:border-brand-amber/40',
              )}
            >
              <span
                className={cn('w-1.5 h-1.5 rounded-full', isDone ? 'bg-status-success' : 'bg-text-muted')}
              />
              {isDone ? 'Concluída' : 'Pendente'}
            </button>
          </div>

          {/* Lead */}
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Tag size={12} />
            <span className="text-text-secondary">{task.leadName}</span>
          </div>

          {/* Assignee */}
          <div>
            <p className="text-xs font-medium text-text-muted mb-2">
              <User size={11} className="inline mr-1" />
              Responsável
            </p>
            <select
              defaultValue={task.assignedTo ?? ''}
              onChange={(e) => handleFieldUpdate({ assignedTo: e.target.value || null })}
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

          {/* Due date */}
          <div>
            <p className="text-xs font-medium text-text-muted mb-2">
              <Calendar size={11} className="inline mr-1" />
              Prazo
            </p>
            <Input
              type="date"
              defaultValue={task.dueDate ? task.dueDate.slice(0, 10) : ''}
              onChange={(e) => handleFieldUpdate({ dueDate: e.target.value || null })}
            />
          </div>

          {/* Completed at */}
          {task.completedAt && (
            <p className="text-xs text-text-muted">
              Concluída em {formatDate(task.completedAt)}
            </p>
          )}

          {/* Created by */}
          <p className="text-xs text-text-muted">
            Criada por {task.createdByName ?? 'sistema'} em {formatDate(task.createdAt)}
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-brand-border shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            loading={isDeleting}
            className="w-full text-status-error hover:text-status-error hover:bg-status-error/10"
          >
            <Trash2 size={13} />
            Remover tarefa
          </Button>
        </div>
      </div>
    </div>
  );
}
