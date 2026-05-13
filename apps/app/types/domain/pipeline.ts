export type StageType = 'active' | 'won' | 'lost';

export interface StageLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  aiClassification: 'hot' | 'warm' | 'cold' | null;
  aiScore: number | null;
  assignedTo: string | null;
  createdAt: string;
}

export interface PipelineStage {
  id: string;
  orgId: string;
  name: string;
  position: number;
  color: string;
  stageType: StageType;
  isDefault: boolean;
  leads: StageLead[];
  leadCount: number;
}

export interface PipelineBoard {
  stages: PipelineStage[];
}

export interface UpdateStagePayload {
  name?: string;
  color?: string;
}
