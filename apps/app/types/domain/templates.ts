export interface TemplatePipelineStage {
  name: string;
  position: number;
  color: string;
  stageType: 'active' | 'won' | 'lost';
  isDefault: boolean;
}

export interface TemplateWorkflow {
  name: string;
  description: string;
  triggerType: string;
  triggerConditions: Record<string, unknown>;
  actionType: string;
  actionConfig: Record<string, unknown>;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  niche: string;
  version: string;
  pipelineStages: TemplatePipelineStage[];
  workflows: TemplateWorkflow[];
  aiPrompts: {
    classify: string;
    respond: string;
    followUp: string;
  };
}

export interface ApplyTemplatePayload {
  templateId: string;
}
