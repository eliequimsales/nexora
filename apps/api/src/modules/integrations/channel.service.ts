import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { IntegrationCryptoService } from './integration-crypto.service';
import { EmailAdapter } from './adapters/email.adapter';
import { WhatsAppAdapter } from './adapters/whatsapp.adapter';
import type { EmailConfig } from './adapters/email.adapter';
import type { WhatsAppConfig } from './adapters/whatsapp.adapter';

export interface SendEmailPayload {
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: IntegrationCryptoService,
    private readonly email: EmailAdapter,
    private readonly whatsapp: WhatsAppAdapter,
  ) {}

  async sendMessage(
    orgId: string,
    channel: 'whatsapp' | 'email',
    to: string,
    content: string,
    subject?: string,
  ): Promise<void> {
    const cfg = await this.getDecryptedConfig(orgId, channel);
    if (!cfg) throw new BadRequestException(`Canal ${channel} não configurado`);

    if (channel === 'whatsapp') {
      await this.whatsapp.send(cfg as unknown as WhatsAppConfig, to, content);
    } else {
      await this.email.send(cfg as unknown as EmailConfig, to, {
        subject: subject ?? "Mensagem da B'reshit",
        text: content,
      });
    }

    await this.logOutbound(orgId, channel, to, content.length);
  }

  async sendEmail(orgId: string, to: string, payload: SendEmailPayload): Promise<void> {
    const cfg = await this.getDecryptedConfig(orgId, 'email');
    if (!cfg) throw new BadRequestException('Canal email não configurado');

    try {
      await this.email.send(cfg as unknown as EmailConfig, to, payload);
      await this.logOutbound(orgId, 'email', to, payload.text.length);
    } catch (err) {
      await this.logOutboundError(orgId, 'email', to, err);
      throw err;
    }
  }

  async testChannel(orgId: string, channel: 'whatsapp' | 'email'): Promise<{ ok: boolean; error?: string }> {
    const cfg = await this.getDecryptedConfig(orgId, channel);
    if (!cfg) return { ok: false, error: 'Canal não configurado' };

    if (channel === 'whatsapp') return this.whatsapp.testConnection(cfg as unknown as WhatsAppConfig);
    return this.email.testConnection(cfg as unknown as EmailConfig);
  }

  async getDecryptedConfig(orgId: string, channel: string): Promise<Record<string, unknown> | null> {
    const row = await this.prisma.integrationConfig.findUnique({
      where: { orgId_channel: { orgId, channel } },
    });
    if (!row || !row.isActive) return null;
    try {
      return JSON.parse(this.crypto.decrypt(row.config));
    } catch {
      return null;
    }
  }

  private async logOutbound(orgId: string, channel: string, to: string, contentLength: number): Promise<void> {
    await this.prisma.integrationLog.create({
      data: {
        orgId,
        channel,
        direction: 'outbound',
        status: 'success',
        payload: { to, contentLength } as object,
      },
    });
  }

  private async logOutboundError(orgId: string, channel: string, to: string, err: unknown): Promise<void> {
    const errorMessage = err instanceof Error ? err.message : String(err);
    this.logger.error(`Channel send failed [${channel}] to ${to}: ${errorMessage}`);
    await this.prisma.integrationLog.create({
      data: {
        orgId,
        channel,
        direction: 'outbound',
        status: 'error',
        payload: { to, error: errorMessage } as object,
      },
    }).catch(() => undefined);
  }
}
