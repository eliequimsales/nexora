import type { AiActionType } from './ai-actions';
import type { Lead } from './leads';

export type VoiceActionStatus =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'understanding'
  | 'ambiguous'
  | 'ready'
  | 'executing'
  | 'success'
  | 'error';

export type VoiceActionRisk = 'low' | 'medium' | 'high' | 'critical';
export type VoiceActionConfidence = 'high' | 'medium' | 'low';
export type VoiceActionAvailability = 'available' | 'planned' | 'blocked';
export type VoiceActionExecutionMode = 'direct' | 'confirm' | 'review' | 'blocked';

export type VoiceIntentType =
  | 'summarize_lead'
  | 'classify_lead'
  | 'generate_response'
  | 'generate_follow_up'
  | 'ask_copilot'
  | 'create_task'
  | 'move_to_proposal'
  | 'mark_qualified'
  | 'create_note'
  | 'unknown';

export interface VoiceActionIntent {
  type: VoiceIntentType;
  label: string;
  description: string;
  transcript: string;
  risk: VoiceActionRisk;
  confidence: VoiceActionConfidence;
  availability: VoiceActionAvailability;
  executionMode: VoiceActionExecutionMode;
  previewTitle: string;
  previewDescription: string;
  aiActionType?: AiActionType;
  noteContent?: string;
  taskTitle?: string;
  taskDueDays?: number;
}

export interface VoiceActionSuggestion {
  id: string;
  label: string;
  command: string;
  reason: string;
  availability: VoiceActionAvailability;
}

export interface VoiceActionExecutionResult {
  title: string;
  description?: string;
}

export interface VoiceActionContext {
  lead: Lead;
}
