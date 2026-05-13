export type AiClassification = 'hot' | 'warm' | 'cold';

export interface LLMResult {
  content: string;
  tokensInput: number;
  tokensOutput: number;
  latencyMs: number;
}

export interface ClassifyResult {
  classification: AiClassification;
  score: number;
  justification: string;
}

export interface LeadJobPayload {
  leadId: string;
  orgId: string;
}
