import { Injectable } from '@nestjs/common';

export interface AssistantPersona {
  name?: string;
  tone?: string;
  style?: string;
}

export interface PromptVariables {
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  ai_classification: string | null;
  ai_score: number | null;
  follow_up_count: number;
  activity_history: string;
  assistant_name: string;
  assistant_tone: string;
  assistant_style: string;
  [key: string]: unknown; // nicheData fields
}

@Injectable()
export class PromptService {
  /**
   * Substitui {{variavel}} no template com os valores do lead.
   * Variáveis desconhecidas tornam-se string vazia — nunca lança erro.
   * Nenhuma interpolação dinâmica: substituição é puramente textual.
   */
  build(template: string, variables: PromptVariables): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      const value = variables[key];
      if (value === null || value === undefined) return '';
      return String(value);
    });
  }

  buildVariables(lead: any, activityHistory: string, persona?: AssistantPersona): PromptVariables {
    const nicheData = (lead.nicheData ?? {}) as Record<string, unknown>;

    return {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      status: lead.status,
      ai_classification: lead.aiClassification,
      ai_score: lead.aiScore,
      follow_up_count: lead.followUpCount,
      activity_history: activityHistory,
      assistant_name: persona?.name ?? 'Assistente',
      assistant_tone: persona?.tone ?? 'formal',
      assistant_style: persona?.style ?? 'concise',
      ...Object.fromEntries(
        Object.entries(nicheData).map(([k, v]) => [k, v]),
      ),
    };
  }
}
