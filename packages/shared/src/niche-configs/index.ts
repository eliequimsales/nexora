import { genericSalesConfig } from './generic_sales';
import { ecommerceSocialConfig } from './ecommerce_social';
import { constructionConfig } from './construction';
import { culinaryConfig } from './culinary';
import { beautyWellnessConfig } from './beauty_wellness';
import { professionalServicesConfig } from './professional_services';
import { realEstateConfig } from './real_estate';
import { barbeariaConfig } from './barbearia';
import type { NicheConfig } from './types';

const NICHE_CONFIGS: Record<string, NicheConfig> = {
  generic_sales: genericSalesConfig,
  ecommerce_social: ecommerceSocialConfig,
  construction: constructionConfig,
  culinary: culinaryConfig,
  beauty_wellness: beautyWellnessConfig,
  professional_services: professionalServicesConfig,
  real_estate: realEstateConfig,
  barbearia: barbeariaConfig,
};

export function getNicheConfig(niche: string): NicheConfig {
  const config = NICHE_CONFIGS[niche];
  if (!config) {
    throw new Error(`Niche config not found: "${niche}". Available: ${Object.keys(NICHE_CONFIGS).join(', ')}`);
  }
  return config;
}

export function getSupportedNiches(): string[] {
  return Object.keys(NICHE_CONFIGS);
}

export { realEstateConfig };
export type { NicheConfig };
