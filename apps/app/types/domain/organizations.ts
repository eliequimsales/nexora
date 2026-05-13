export interface AssistantPersona {
  name?: string;
  tone?: 'formal' | 'casual' | 'friendly';
  style?: 'concise' | 'detailed' | 'empathetic';
}

export interface SecretarySettings {
  enabled?: boolean;
}

export interface OnboardingSettings {
  dismissed?: boolean;
  wizardStep?: number;
  wizardCompleted?: boolean;
  wizardCompletedAt?: string;
}

export interface AppliedTemplateInfo {
  id: string;
  appliedAt: string;
  version: string;
}

export interface OrgSettings {
  timezone?: string;
  language?: 'pt-BR' | 'en-US';
  notifications?: {
    newLead?: boolean;
    aiAlert?: boolean;
  };
  assistant?: AssistantPersona;
  secretary?: SecretarySettings;
  onboarding?: OnboardingSettings;
  appliedTemplate?: AppliedTemplateInfo;
  aiPrompts?: Record<string, string>;
}

// Full org response from GET /organizations/me and PATCH /organizations/me
export interface OrgResponse {
  id: string;
  name: string;
  slug: string;
  niche: string;
  status: string;
  formToken: string;
  settings: OrgSettings;
  aiPrompts: Record<string, string>;
  createdAt: string;
}

export interface UpdateOrgPayload {
  name?: string;
  settings?: OrgSettings;
  aiPrompts?: { classify?: string; respond?: string; followUp?: string };
}
