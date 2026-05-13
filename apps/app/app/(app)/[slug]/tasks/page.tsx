'use client';

import { useState } from 'react';
import { CanDo } from '@/components/shared/CanDo/CanDo';
import { TasksList } from '@/components/modules/tasks/TasksList';
import { TaskDetailDrawer } from '@/components/modules/tasks/TaskDetailDrawer';
import { useTasksQuery } from '@/lib/hooks/tasks/useTasksQuery';
import { useAuthStore } from '@/lib/stores/auth.store';
import type { Task } from '@/types';

type TabView = 'mine' | 'all' | 'done';

const TABS: { id: TabView; label: string }[] = [
  { id: 'mine', label: 'Minhas' },
  { id: 'all', label: 'Todas' },
  { id: 'done', label: 'Concluídas' },
];

function buildParams(tab: TabView, userId: string | undefined) {
  switch (tab) {
    case 'mine':
      return { assignedTo: userId, status: 'pending' as const };
    case 'done':
      return { status: 'done' as const };
    default:
      return {};
  }
}

export default function TasksPage() {
  const [tab, setTab] = useState<TabView>('mine');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const user = useAuthStore((s) => s.user);

  const params = buildParams(tab, user?.id);
  const { data, isLoading, isError } = useTasksQuery(params);
  const tasks = data?.data;

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Tarefas</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Acompanhe e organize as ações pendentes dos seus leads.
          </p>
        </div>
        <CanDo permission="tasks:manage">
          <p className="text-xs text-text-muted">Crie tarefas a partir dos leads</p>
        </CanDo>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-brand-surface-2 rounded-lg p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-brand-surface text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <TasksList
        tasks={tasks}
        isLoading={isLoading}
        isError={isError}
        onTaskClick={setSelectedTask}
        emptyMessage={
          tab === 'mine'
            ? 'Nenhuma tarefa atribuída a você'
            : tab === 'done'
            ? 'Nenhuma tarefa concluída'
            : 'Nenhuma tarefa criada ainda'
        }
      />

      {data && data.totalPages > 1 && (
        <p className="text-xs text-text-muted text-center mt-4">
          {data.total} tarefas · página {data.page} de {data.totalPages}
        </p>
      )}

      {selectedTask && (
        <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
