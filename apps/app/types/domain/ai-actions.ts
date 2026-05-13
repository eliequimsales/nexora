export type AiActionType = 'ai_classify' | 'ai_respond' | 'ai_follow_up';
export type AiExecutionStatus = 'pending' | 'success' | 'failed';

export interface AiActionResult {
  executionId: string;
  actionType: AiActionType;
  status: 'success' | 'failed';
  result: Record<string, unknown>;
  errorMessage?: string;
}

export interface AiExecution {
  id: string;
  leadId: string;
  leadName?: string;
  triggerType: string;
  actionType: string;
  promptVersion: string;
  status: AiExecutionStatus;
  tokensInput: number | null;
  tokensOutput: number | null;
  latencyMs: number | null;
  errorMessage: string | null;
  createdAt: string;
}
