import { Injectable, NotFoundException } from '@nestjs/common';
import { listTemplates, getTemplate } from '@reshit/shared';
import type { TemplateDefinition } from '@reshit/shared';

@Injectable()
export class TemplatesService {
  list(): TemplateDefinition[] {
    return listTemplates();
  }

  getById(id: string): TemplateDefinition {
    const template = getTemplate(id);
    if (!template) throw new NotFoundException(`Template "${id}" não encontrado`);
    return template;
  }
}
