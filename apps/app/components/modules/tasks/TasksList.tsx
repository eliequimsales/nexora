'use client';

import { ClipboardList, AlertCircle } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { TaskRow } from './TaskRow';
import type { Task } from '@/types';

interface TasksListProps {
  tasks: Task[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onTaskClick: (task: Task) => void;
  emptyMessage?: string;
}

export function TasksList({
  tasks,
  isLoading,
  isError,
  onTaskClick,
  emptyMessage = 'Nenhuma tarefa encontrada',
}: TasksListProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
        <SkeletonList rows={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border-2 border-dashed border-status-error/20 p-12 text-center">
        <AlertCircle size={22} className="text-status-error mx-auto mb-3 opacity-70" />
        <p className="text-sm font-medium text-text-primary">Não foi possível carregar as tarefas</p>
      </div>
    );
  }

  if (!tasks?.length) {
    return (
      <EmptyState
        icon={<ClipboardList size={24} />}
        title={emptyMessage}
        description="Tarefas são criadas a partir dos leads."
      />
    );
  }

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} onClick={() => onTaskClick(task)} />
      ))}
    </div>
  );
}
