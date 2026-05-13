export type TriggerType =
  | 'lead_created'
  | 'lead_status_changed'
  | 'lead_stage_changed'
  | 'lead_classified';

export type ActionType =
  | 'ai_classify'
  | 'ai_respond'
  | 'ai_follow_up'
  | 'create_task'
  | 'move_stage'
  | 'update_status';

export interface Workflow {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  triggerType: TriggerType;
  triggerConditions: Record<string, unknown>;
  actionType: ActionType;
  actionConfig: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowExecutionStatus = 'pending' | 'success' | 'failed' | 'skipped';

export interface WorkflowWithStats extends Workflow {
  executionsToday: number;
  successToday: number;
  failedToday: number;
  latestExecutionStatus?: WorkflowExecutionStatus;
  latestExecutionErrorMessage?: string | null;
  latestExecutionResult?: Record<string, unknown>;
  latestExecutionAt?: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  leadId: string;
  status: 'pending' | 'success' | 'failed' | 'skipped';
  triggeredBy: string;
  result: Record<string, unknown>;
  errorMessage: string | null;
  executedAt: string;
}

export interface CreateWorkflowPayload {
  name: string;
  description?: string;
  isActive?: boolean;
  triggerType: TriggerType;
  triggerConditions?: Record<string, unknown>;
  actionType: ActionType;
  actionConfig?: Record<string, unknown>;
}

export interface UpdateWorkflowPayload extends Partial<CreateWorkflowPayload> {}

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  lead_created: 'Lead criado',
  lead_status_changed: 'Status do lead alterado',
  lead_stage_changed: 'Lead movido de estágio',
  lead_classified: 'Lead classificado pela IA',
};

export const ACTION_LABELS: Record<ActionType, string> = {
  ai_classify: 'Classificar com IA',
  ai_respond: 'Responder com IA',
  ai_follow_up: 'Follow-up com IA',
  create_task: 'Criar tarefa',
  move_stage: 'Mover estágio',
  update_status: 'Atualizar status',
};
