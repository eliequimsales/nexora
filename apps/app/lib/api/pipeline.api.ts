import { apiClient } from './client';
import type { PipelineBoard, UpdateStagePayload } from '@/types';

export const pipelineApi = {
  board: () => apiClient.get<PipelineBoard>('/pipeline/board'),
  updateStage: (id: string, payload: UpdateStagePayload) =>
    apiClient.patch(`/pipeline/stages/${id}`, payload),
};
