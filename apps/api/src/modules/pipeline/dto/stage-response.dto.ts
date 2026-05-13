export interface StageLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  aiClassification: string | null;
  aiScore: number | null;
  assignedTo: string | null;
  createdAt: Date;
}

export interface PipelineStageDto {
  id: string;
  orgId: string;
  name: string;
  position: number;
  color: string;
  stageType: string;
  isDefault: boolean;
  leads: StageLead[];
  leadCount: number;
}

export interface PipelineBoardDto {
  stages: PipelineStageDto[];
}

export function mapStageWithLeads(stage: any): PipelineStageDto {
  const leads: StageLead[] = (stage.leads ?? []).map((l: any) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    phone: l.phone,
    status: l.status,
    aiClassification: l.aiClassification,
    aiScore: l.aiScore,
    assignedTo: l.assignedTo,
    createdAt: l.createdAt,
  }));

  return {
    id: stage.id,
    orgId: stage.orgId,
    name: stage.name,
    position: stage.position,
    color: stage.color,
    stageType: stage.stageType,
    isDefault: stage.isDefault,
    leads,
    leadCount: leads.length,
  };
}
