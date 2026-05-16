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

/**
 * Inactive client — a lead that hasn't been touched in N days,
 * surfaced by the Nexora recovery screen.
 *
 * Mirrors the backend `findInactive()` output: a minimal lead projection plus
 * derived `daysSinceLastActivity` and `estimatedValue` (R$80 default ticket).
 */
export interface InactiveClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  aiClassification: LeadClassification | null;
  updatedAt: string;
  daysSinceLastActivity: number;
  estimatedValue: number;
}

/** Canal de envio da mensagem de recuperação. */
export type RecoveryChannel = 'whatsapp' | 'email';

/**
 * Resposta do endpoint POST /leads/:id/recuperar.
 * Espelha `RecoveryResult` do backend.
 */
export interface RecoveryResult {
  success: boolean;
  leadId: string;
  channel: RecoveryChannel;
  message: string;
  sentTo: string;
  externalId?: string;
  error?: string;
}
