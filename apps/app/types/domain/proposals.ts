export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';

export interface ProposalItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  position: number;
}

export interface Proposal {
  id: string;
  orgId: string;
  leadId: string;
  leadName: string | null;
  createdBy: string;
  title: string;
  status: ProposalStatus;
  token: string | null;
  note: string | null;
  validUntil: string | null;
  totalAmount: number;
  items: ProposalItem[];
  viewCount: number;
  sentAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicProposal {
  id: string;
  orgName: string;
  title: string;
  status: ProposalStatus;
  note: string | null;
  validUntil: string | null;
  totalAmount: number;
  items: ProposalItem[];
  leadName: string | null;
}

export interface CreateProposalItemPayload {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateProposalPayload {
  leadId: string;
  title: string;
  note?: string;
  validUntil?: string;
  items: CreateProposalItemPayload[];
}

export interface UpdateProposalPayload {
  title?: string;
  note?: string;
  validUntil?: string;
  items?: CreateProposalItemPayload[];
}

export interface ListProposalsParams {
  page?: number;
  limit?: number;
  status?: ProposalStatus;
  leadId?: string;
}
