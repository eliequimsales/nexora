'use client';

import { useQuery } from '@tanstack/react-query';
import { pipelineApi } from '@/lib/api/pipeline.api';

export const PIPELINE_BOARD_KEY = ['pipeline', 'board'] as const;

export function usePipelineBoard() {
  return useQuery({
    queryKey: PIPELINE_BOARD_KEY,
    queryFn: () => pipelineApi.board().then((r) => r.data),
    staleTime: 20_000,
  });
}
