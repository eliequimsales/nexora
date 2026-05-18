import type { Organization } from '@prisma/client';

export interface OrgResponseDto {
  id: string;
  name: string;
  slug: string;
  niche: string;
  status: string;
  formToken: string;
  settings: Record<string, unknown>;
  aiPrompts: Record<string, string>;
  createdAt: Date;
  lgpdAcceptedAt: Date | null;
  lgpdTermVersion: string | null;
}

export function mapOrg(org: Organization): OrgResponseDto {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    niche: org.niche,
    status: org.status,
    formToken: org.formToken,
    settings: (org.settings ?? {}) as Record<string, unknown>,
    aiPrompts: (org.aiPrompts ?? {}) as Record<string, string>,
    createdAt: org.createdAt,
    lgpdAcceptedAt: org.lgpdAcceptedAt,
    lgpdTermVersion: org.lgpdTermVersion,
  };
}
