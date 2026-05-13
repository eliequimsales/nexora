export interface IntegrationConfig {
  id: string;
  channel: string;
  isActive: boolean;
  fields: Record<string, unknown>;
  updatedAt: string;
}

export interface OutboundWebhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  signingSecret?: string; // only on create response
}

export interface IntegrationLog {
  id: string;
  channel: string;
  direction: 'inbound' | 'outbound';
  status: 'success' | 'failed';
  targetUrl?: string;
  httpStatus?: number;
  errorMsg?: string;
  attempts: number;
  createdAt: string;
}
