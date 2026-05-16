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

export interface IntegrationSettings {
  zapiApiKey?: string;
  zapiWebhookUrl?: string;
  resendApiKey?: string;
}

export interface NexoraRecoverySettings {
  inactivityDays?: number; // Default: 30 days
  whatsappTemplate?: string; // Message template for WhatsApp
  emailTemplate?: string; // Message template for Email
  zapiApiKey?: string; // Z-API key (encrypted)
  resendApiKey?: string; // Resend API key (encrypted)
  whatsappEnabled?: boolean; // Enable WhatsApp recovery
  emailEnabled?: boolean; // Enable Email recovery
}

export interface NexoraSettings {
  inactivityDays?: number; // Default: 30
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
  integrations?: IntegrationSettings;
  nexora?: NexoraSettings;
  nexoraRecovery?: NexoraRecoverySettings;
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
