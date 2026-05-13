import type { PipelineStageConfig, AiPromptsConfig } from '../niche-configs/types';

export interface TemplateWorkflowDef {
  name: string;
  description: string;
  triggerType: string;
  triggerConditions: Record<string, unknown>;
  actionType: string;
  actionConfig: Record<string, unknown>;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  niche: string;
  version: string;
  pipelineStages: PipelineStageConfig[];
  workflows: TemplateWorkflowDef[];
  aiPrompts: AiPromptsConfig;
}
