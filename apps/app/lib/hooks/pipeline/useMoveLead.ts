'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/lib/api/leads.api';
import { PIPELINE_BOARD_KEY } from './usePipelineBoard';

export function useMoveLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, stageId }: { leadId: string; stageId: string }) =>
      leadsApi.update(leadId, { pipelineStageId: stageId }),

    // Optimistic update: move the card visually before the server confirms
    onMutate: async ({ leadId, stageId }) => {
      await queryClient.cancelQueries({ queryKey: PIPELINE_BOARD_KEY });
      const previous = queryClient.getQueryData(PIPELINE_BOARD_KEY);

      queryClient.setQueryData(PIPELINE_BOARD_KEY, (old: any) => {
        if (!old) return old;
        return {
          stages: old.stages.map((stage: any) => ({
            ...stage,
            leads: stage.leads.filter((l: any) => l.id !== leadId),
          })).map((stage: any) => {
            if (stage.id !== stageId) return stage;
            // find the lead from the previous state to re-insert
            const lead = old.stages.flatMap((s: any) => s.leads).find((l: any) => l.id === leadId);
            if (!lead) return stage;
            return {
              ...stage,
              leads: [lead, ...stage.leads],
              leadCount: stage.leads.length + 1,
            };
          }),
        };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PIPELINE_BOARD_KEY, context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PIPELINE_BOARD_KEY });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}
