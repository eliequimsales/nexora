export interface ProposalItemDto {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  position: number;
}

export interface ProposalDto {
  id: string;
  orgId: string;
  leadId: string;
  leadName: string | null;
  createdBy: string;
  title: string;
  status: string;
  token: string | null;
  note: string | null;
  validUntil: string | null;
  totalAmount: number;
  items: ProposalItemDto[];
  viewCount: number;
  sentAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicProposalDto {
  id: string;
  orgName: string;
  title: string;
  status: string;
  note: string | null;
  validUntil: string | null;
  totalAmount: number;
  items: ProposalItemDto[];
  leadName: string | null;
}

function mapItem(item: any): ProposalItemDto {
  return {
    id: item.id,
    description: item.description,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    total: Number(item.total),
    position: item.position,
  };
}

export function mapProposal(p: any): ProposalDto {
  return {
    id: p.id,
    orgId: p.orgId,
    leadId: p.leadId,
    leadName: p.lead?.name ?? null,
    createdBy: p.createdBy,
    title: p.title,
    status: p.status,
    token: p.token ?? null,
    note: p.note ?? null,
    validUntil: p.validUntil?.toISOString() ?? null,
    totalAmount: Number(p.totalAmount),
    items: (p.items ?? []).sort((a: any, b: any) => a.position - b.position).map(mapItem),
    viewCount: p._count?.views ?? p.views?.length ?? 0,
    sentAt: p.sentAt?.toISOString() ?? null,
    viewedAt: p.viewedAt?.toISOString() ?? null,
    respondedAt: p.respondedAt?.toISOString() ?? null,
    archivedAt: p.archivedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function mapPublicProposal(p: any): PublicProposalDto {
  return {
    id: p.id,
    orgName: p.organization?.name ?? '',
    title: p.title,
    status: p.status,
    note: p.note ?? null,
    validUntil: p.validUntil?.toISOString() ?? null,
    totalAmount: Number(p.totalAmount),
    items: (p.items ?? []).sort((a: any, b: any) => a.position - b.position).map(mapItem),
    leadName: p.lead?.name ?? null,
  };
}
