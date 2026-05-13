import { realEstateTemplate } from './real_estate.template';
import type { TemplateDefinition } from './types';

const TEMPLATES: Record<string, TemplateDefinition> = {
  real_estate_v1: realEstateTemplate,
};

export function listTemplates(): TemplateDefinition[] {
  return Object.values(TEMPLATES);
}

export function getTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES[id];
}

export { realEstateTemplate };
export type { TemplateDefinition };
