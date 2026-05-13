export type CopilotSuggestionType =
  | 'unclassified_leads'
  | 'hot_no_response'
  | 'stale_no_followup'
  | 'inactive_workflow'
  | 'pipeline_stalled';

export interface CopilotSuggestion {
  type: CopilotSuggestionType;
  title: string;
  reason: string;
  count: number;
  leadIds: string[];
  workflowId?: string;
  workflowName?: string;
  priority: 1 | 2 | 3;
}
