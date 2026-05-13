import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import type {
  MessageDeliveryProvider,
  DeliveryRequest,
  DeliveryResult,
  DeliveryStatus,
} from './message-delivery-provider.interface';

@Injectable()
export class ResendEmailProvider implements MessageDeliveryProvider {
  readonly channel = 'email' as const;
  private readonly logger = new Logger(ResendEmailProvider.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly timeoutMs = 10000;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('resend.apiKey') || '';
    this.fromEmail = this.config.get<string>('resend.fromEmail') || '';
    this.fromName = this.config.get<string>('resend.fromName') || 'Assistente Financeiro';
  }

  async send(request: DeliveryRequest): Promise<DeliveryResult> {
    if (!this.apiKey || !this.fromEmail) {
      this.logger.warn('Resend not configured');
      return { success: false, status: 'failed', error: 'provider_not_configured', retryable: false };
    }

    try {
      const response = await axios.post(
        'https://api.resend.com/emails',
        {
          from: `${this.fromName} <${this.fromEmail}>`,
          to: [request.recipient],
          subject: request.subject || 'Recuperação de cliente',
          text: request.message,
        },
        {
          timeout: this.timeoutMs,
          headers: { Authorization: `Bearer ${this.apiKey}` },
        },
      );

      return {
        success: true,
        externalId: response.data?.id,
        status: 'sent',
      };
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status ?? 500;
      const retryable = status >= 500 || status === 429;
      this.logger.error(`Resend send failed (${status}): ${axiosErr.message}`);
      return {
        success: false,
        status: 'failed',
        error: axiosErr.message,
        retryable,
      };
    }
  }

  parseWebhook(payload: unknown): { externalId: string; status: DeliveryStatus } | null {
    if (!payload || typeof payload !== 'object') return null;
    const p = payload as { type?: string; data?: { email_id?: string } };
    if (!p.type || !p.data?.email_id) return null;

    const statusMap: Record<string, DeliveryStatus> = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.opened': 'read',
      'email.bounced': 'bounced',
      'email.failed': 'failed',
    };
    const mapped = statusMap[p.type];
    if (!mapped) return null;
    return { externalId: p.data.email_id, status: mapped };
  }
}
