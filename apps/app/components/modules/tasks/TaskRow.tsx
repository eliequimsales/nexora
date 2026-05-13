'use client';

import { Calendar, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompleteTask } from '@/lib/hooks/tasks/useCompleteTask';
import { useUpdateTask } from '@/lib/hooks/tasks/useUpdateTask';
import { formatDate } from '@/lib/utils';
import type { Task } from '@/types';

interface TaskRowProps {
  task: Task;
  onClick: () => void;
}

function isOverdue(task: Task): boolean {
  if (task.status === 'done' || !task.dueDate) return false;
  return new Date(task.dueDate) < new Date();
}

export function TaskRow({ task, onClick }: TaskRowProps) {
  const complete = useCompleteTask();
  const reopen = useUpdateTask(task.id);
  const overdue = isOverdue(task);
  const isDone = task.status === 'done';

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (isDone) {
      reopen.mutate({ status: 'pending' });
    } else {
      complete.mutate(task.id);
    }
  }

  return (
    <div
      onClick={onClick}
      className="flex items-start gap-3 py-3 px-1 border-b border-brand-border last:border-0 hover:bg-brand-surface-2/40 cursor-pointer rounded transition-colors -mx-1 group"
    >
      <button
        onClick={handleToggle}
        disabled={complete.isPending || reopen.isPending}
        aria-label={isDone ? 'Reabrir tarefa' : 'Concluir tarefa'}
        className={cn(
          'mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors',
          isDone
            ? 'bg-status-success border-status-success text-white'
            : 'border-brand-border hover:border-brand-amber',
        )}
      >
        {isDone && (
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none" aria-hidden>
            <path d="M1 3l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm text-text-primary truncate', isDone && 'line-through text-text-muted')}>
          {task.title}
        </p>
        <p className="text-xs text-text-muted mt-0.5 truncate">{task.leadName}</p>

        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {task.assignedUserName && (
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <User size={10} />
              {task.assignedUserName}
            </span>
          )}
          {task.dueDate && (
            <span
              className={cn(
                'flex items-center gap-1 text-xs',
                overdue ? 'text-status-error' : 'text-text-muted',
              )}
            >
              <Calendar size={10} />
              {formatDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
