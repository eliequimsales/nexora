'use client';

import { useRef, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { KanbanColumn } from './KanbanColumn';
import { usePipelineBoard } from '@/lib/hooks/pipeline/usePipelineBoard';
import { useMoveLead } from '@/lib/hooks/pipeline/useMoveLead';

function KanbanBoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 4 }).map((_, columnIndex) => (
        <div key={columnIndex} className="min-w-[260px] max-w-[260px]">
          <Skeleton height="20px" width="96px" className="mb-3 rounded" />
          <div className="rounded-xl border-2 border-dashed border-brand-border bg-brand-surface/50 p-2 space-y-2 min-h-[200px]">
            {Array.from({ length: 3 }).map((_, cardIndex) => (
              <Skeleton key={cardIndex} variant="card" height="64px" className="rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function KanbanBoard() {
  const { data, isLoading, isError } = usePipelineBoard();
  const { mutate: moveLead } = useMoveLead();

  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const dragging = useRef<{ leadId: string; fromStageId: string } | null>(null);

  function handleDragStart(e: React.DragEvent, leadId: string, fromStageId: string) {
    dragging.current = { leadId, fromStageId };
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStageId(stageId);
  }

  function handleDrop(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    setDragOverStageId(null);

    const { leadId, fromStageId } = dragging.current ?? {};
    if (!leadId || !fromStageId || fromStageId === stageId) return;

    moveLead({ leadId, stageId });
    dragging.current = null;
  }

  function handleDragLeave() {
    setDragOverStageId(null);
  }

  if (isLoading) {
    return <KanbanBoardSkeleton />;
  }

  if (isError) {
    return (
      <p className="text-sm text-status-error py-8 text-center">
        Erro ao carregar o pipeline. Tente recarregar.
      </p>
    );
  }

  const stages = data?.stages ?? [];

  if (stages.length === 0) {
    return (
      <EmptyState
        icon={<LayoutGrid size={24} />}
        title="Nenhum estagio configurado"
        description="Configure os estagios do pipeline em Configuracoes."
      />
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => (
        <KanbanColumn
          key={stage.id}
          stage={stage}
          isDragOver={dragOverStageId === stage.id}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragLeave={handleDragLeave}
        />
      ))}
    </div>
  );
}
