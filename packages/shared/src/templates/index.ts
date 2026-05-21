import { realEstateTemplate } from './real_estate.template';
import { beautyWellnessTemplate } from './beauty_wellness.template';
import type { TemplateDefinition } from './types';

const TEMPLATES: Record<string, TemplateDefinition> = {
  beauty_wellness_v1: beautyWellnessTemplate,
  real_estate_v1: realEstateTemplate,
};

export function listTemplates(): TemplateDefinition[] {
  return Object.values(TEMPLATES);
}

/**
 * Filtra templates pelo niche da organização.
 * Se nenhum match, retorna todos (fallback).
 */
export function listTemplatesByNiche(niche: string): TemplateDefinition[] {
  const matching = Object.values(TEMPLATES).filter((t) => t.niche === niche);
  return matching.length > 0 ? matching : Object.values(TEMPLATES);
}

export function getTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES[id];
}

export { realEstateTemplate, beautyWellnessTemplate };
export type { TemplateDefinition };
