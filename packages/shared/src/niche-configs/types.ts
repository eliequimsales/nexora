export interface PipelineStageConfig {
  name: string;
  position: number;
  color: string;
  stageType: 'active' | 'won' | 'lost';
  isDefault: boolean;
}

export interface LeadFieldConfig {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'currency';
  required: boolean;
  options?: string[];
}

export interface AiPromptsConfig {
  classify: string;
  respond: string;
  followUp: string;
}

export interface NicheLabels {
  leadSingular: string;
  leadPlural: string;
  nicheDisplayName: string;
}

export interface NicheConfig {
  niche: string;
  pipelineStages: PipelineStageConfig[];
  leadFields: LeadFieldConfig[];
  aiPrompts: AiPromptsConfig;
  labels: NicheLabels;
}
