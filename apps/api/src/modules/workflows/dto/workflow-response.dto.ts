export interface WorkflowResponseDto {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  triggerType: string;
  triggerConditions: Record<string, unknown>;
  actionType: string;
  actionConfig: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowWithStatsDto extends WorkflowResponseDto {
  executionsToday: number;
  successToday: number;
  failedToday: number;
  latestExecutionStatus?: 'success' | 'failed' | 'skipped' | 'pending';
  latestExecutionErrorMessage?: string | null;
  latestExecutionResult?: Record<string, unknown>;
  latestExecutionAt?: Date;
}

export interface WorkflowExecutionDto {
  id: string;
  workflowId: string;
  leadId: string;
  status: string;
  triggeredBy: string;
  result: Record<string, unknown>;
  errorMessage: string | null;
  executedAt: Date;
}

export function mapWorkflow(w: any): WorkflowResponseDto {
  return {
    id: w.id,
    orgId: w.orgId,
    name: w.name,
    description: w.description,
    isActive: w.isActive,
    triggerType: w.triggerType,
    triggerConditions: w.triggerConditions,
    actionType: w.actionType,
    actionConfig: w.actionConfig,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

export function mapExecution(e: any): WorkflowExecutionDto {
  return {
    id: e.id,
    workflowId: e.workflowId,
    leadId: e.leadId,
    status: e.status,
    triggeredBy: e.triggeredBy,
    result: e.result,
    errorMessage: e.errorMessage,
    executedAt: e.executedAt,
  };
}
