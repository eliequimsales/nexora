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
export class ZapiWhatsappProvider implements MessageDeliveryProvider {
  readonly channel = 'whatsapp' as const;
  private readonly logger = new Logger(ZapiWhatsappProvider.name);
  private readonly instanceId: string;
  private readonly token: string;
  private readonly clientToken: string;
  private readonly timeoutMs = 10000;

  constructor(private readonly config: ConfigService) {
    this.instanceId = this.config.get<string>('zapi.instanceId') || '';
    this.token = this.config.get<string>('zapi.token') || '';
    this.clientToken = this.config.get<string>('zapi.clientToken') || '';
  }

  async send(request: DeliveryRequest): Promise<DeliveryResult> {
    if (!this.instanceId || !this.token) {
      this.logger.warn('Z-API not configured');
      return { success: false, status: 'failed', error: 'provider_not_configured', retryable: false };
    }

    const url = `https://api.z-api.io/instances/${this.instanceId}/token/${this.token}/send-text`;

    try {
      const response = await axios.post(
        url,
        { phone: request.recipient, message: request.message },
        {
          timeout: this.timeoutMs,
          headers: { 'Client-Token': this.clientToken },
        },
      );

      const externalId = response.data?.messageId || response.data?.zaapId;
      return {
        success: true,
        externalId,
        status: 'sent',
      };
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status ?? 500;
      const retryable = status >= 500 || status === 429;
      this.logger.error(`Z-API send failed (${status}): ${axiosErr.message}`);
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
    const p = payload as Record<string, unknown>;
    if (typeof p.messageId !== 'string' || typeof p.status !== 'string') return null;

    const statusMap: Record<string, DeliveryStatus> = {
      SENT: 'sent',
      DELIVERED: 'delivered',
      READ: 'read',
      FAILED: 'failed',
    };
    const mapped = statusMap[p.status.toUpperCase()];
    if (!mapped) return null;
    return { externalId: p.messageId, status: mapped };
  }
}
