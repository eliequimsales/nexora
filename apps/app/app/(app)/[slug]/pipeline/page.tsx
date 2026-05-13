'use client';

import { RefreshCw } from 'lucide-react';
import { KanbanBoard } from '@/components/modules/pipeline/KanbanBoard';
import { Button } from '@/components/ui/Button';
import { useQueryClient } from '@tanstack/react-query';
import { PIPELINE_BOARD_KEY } from '@/lib/hooks/pipeline/usePipelineBoard';

export default function PipelinePage() {
  const queryClient = useQueryClient();

  return (
    <div className="p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Pipeline</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Acompanhe seus leads em cada etapa do funil.
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: PIPELINE_BOARD_KEY })}
          title="Atualizar"
        >
          <RefreshCw size={14} />
        </Button>
      </div>

      {/* Board — scrollable horizontally */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard />
      </div>
    </div>
  );
}
