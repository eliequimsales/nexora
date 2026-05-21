import { Injectable, NotFoundException } from '@nestjs/common';
import { listTemplates, listTemplatesByNiche, getTemplate } from '@nexora/shared';
import type { TemplateDefinition } from '@nexora/shared';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list(): TemplateDefinition[] {
    return listTemplates();
  }

  /** Lista templates filtrados pelo niche da organização. */
  async listByOrg(orgId: string): Promise<TemplateDefinition[]> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { niche: true },
    });
    if (!org) return listTemplates();
    return listTemplatesByNiche(org.niche);
  }

  getById(id: string): TemplateDefinition {
    const template = getTemplate(id);
    if (!template) throw new NotFoundException(`Template "${id}" não encontrado`);
    return template;
  }
}
