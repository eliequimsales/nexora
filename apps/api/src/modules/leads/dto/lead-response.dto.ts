export interface LeadResponseDto {
  id: string;
  orgId: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  pipelineStageId: string | null;
  assignedTo: string | null;
  aiScore: number | null;
  aiClassification: string | null;
  followUpCount: number;
  nicheData: Record<string, unknown> | null;
  archivedAt: Date | null;
  createdAt: Date;
}

export function mapLead(lead: any): LeadResponseDto {
  return {
    id: lead.id,
    orgId: lead.orgId,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    status: lead.status,
    pipelineStageId: lead.pipelineStageId,
    assignedTo: lead.assignedTo,
    aiScore: lead.aiScore,
    aiClassification: lead.aiClassification,
    followUpCount: lead.followUpCount,
    nicheData: lead.nicheData,
    archivedAt: lead.archivedAt,
    createdAt: lead.createdAt,
  };
}
