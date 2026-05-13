export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'disqualified'
  | 'closed_won'
  | 'closed_lost';

export type LeadClassification = 'hot' | 'warm' | 'cold';
export type LeadSource = 'manual' | 'form' | 'import' | 'api';

export interface Lead {
  id: string;
  orgId: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  pipelineStageId: string | null;
  assignedTo: string | null;
  aiScore: number | null;
  aiClassification: LeadClassification | null;
  followUpCount: number;
  nicheData: Record<string, unknown> | null;
  archivedAt: string | null;
  createdAt: string;
}

export interface CreateLeadPayload {
  name: string;
  email?: string;
  phone?: string;
  source?: LeadSource;
  pipelineStageId?: string;
}

export interface UpdateLeadPayload {
  name?: string;
  email?: string;
  phone?: string;
  status?: LeadStatus;
  pipelineStageId?: string;
  assignedTo?: string;
}

export interface ListLeadsParams {
  page?: number;
  limit?: number;
  status?: LeadStatus;
  classification?: LeadClassification;
  search?: string;
  assignedTo?: string;
}
