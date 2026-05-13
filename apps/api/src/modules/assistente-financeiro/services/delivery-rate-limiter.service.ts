import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../database/prisma.service';
import { ZapiWhatsappProvider } from '../providers/zapi-whatsapp.provider';
import { ResendEmailProvider } from '../providers/resend-email.provider';
import { RedisService } from '../../../common/redis/redis.service';
import type { MessageDeliveryProvider, DeliveryChannel } from '../providers/message-delivery-provider.interface';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec?: number;
}

@Injectable()
export class DeliveryRateLimiterService {
  constructor(private readonly redis: RedisService) {}

  async checkLimit(
    orgId: string,
    channel: 'whatsapp' | 'email',
    max: number,
    windowSec: number,
  ): Promise<RateLimitResult> {
    const client = this.redis.getClient();
    const key = `af:delivery-limit:${orgId}:${channel}`;

    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, windowSec);
    }

    if (count > max) {
      const ttl = await client.ttl(key);
      return { allowed: false, remaining: 0, retryAfterSec: ttl > 0 ? ttl : windowSec };
    }

    return { allowed: true, remaining: Math.max(0, max - count) };
  }
}

// ============================================================================
// MessageDeliveryService - Orchestrator for message delivery via WhatsApp/Email
// ============================================================================

export interface SendArgs {
  messageSuggestionId: string;
  channel: DeliveryChannel;
  recipient: string;
  subject?: string;
  orgId: string;
}

export interface SendResult {
  success: boolean;
  deliveryId?: string;
  externalId?: string;
  status?: string;
  error?: string;
  retryAfterSec?: number;
}

@Injectable()
export class MessageDeliveryService {
  private readonly logger = new Logger(MessageDeliveryService.name);
  private readonly providers: Record<DeliveryChannel, MessageDeliveryProvider>;
  private readonly rateLimitMax = 60;
  private readonly rateLimitWindowSec = 3600;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: ZapiWhatsappProvider,
    private readonly email: ResendEmailProvider,
    private readonly limiter: DeliveryRateLimiterService,
    @InjectQueue('message-delivery') private readonly queue: Queue,
  ) {
    this.providers = { whatsapp: this.whatsapp, email: this.email };
  }

  async send(args: SendArgs): Promise<SendResult> {
    const limit = await this.limiter.checkLimit(args.orgId, args.channel, this.rateLimitMax, this.rateLimitWindowSec);
    if (!limit.allowed) {
      return { success: false, error: 'rate_limit_exceeded', retryAfterSec: limit.retryAfterSec };
    }

    const suggestion = await this.prisma.assisteFinanceiroMessageSuggestion.findUnique({
      where: { id: args.messageSuggestionId },
    });
    if (!suggestion) {
      throw new NotFoundException(`MessageSuggestion ${args.messageSuggestionId} not found`);
    }

    const delivery = await this.prisma.assisteFinanceiroMessageDelivery.create({
      data: {
        messageSuggestionId: args.messageSuggestionId,
        channel: args.channel,
        recipient: args.recipient,
        status: 'pending',
        attemptCount: 1,
        lastAttemptAt: new Date(),
      },
    });

    const provider = this.providers[args.channel];
    const result = await provider.send({
      recipient: args.recipient,
      message: suggestion.personalizedMessage,
      subject: args.subject,
    });

    await this.prisma.assisteFinanceiroMessageDelivery.update({
      where: { id: delivery.id },
      data: {
        externalId: result.externalId,
        status: result.status,
        errorMessage: result.error,
      },
    });

    if (!result.success && result.retryable) {
      await this.queue.add(
        'retry',
        { deliveryId: delivery.id, args },
        { attempts: 3, backoff: { type: 'exponential', delay: 30000 } },
      );
    }

    return {
      success: result.success,
      deliveryId: delivery.id,
      externalId: result.externalId,
      status: result.status,
      error: result.error,
    };
  }

  async retry(deliveryId: string, args: SendArgs): Promise<SendResult> {
    const delivery = await this.prisma.assisteFinanceiroMessageDelivery.findFirst({
      where: { id: deliveryId },
    });
    if (!delivery) throw new NotFoundException(`Delivery ${deliveryId} not found`);

    const suggestion = await this.prisma.assisteFinanceiroMessageSuggestion.findUnique({
      where: { id: args.messageSuggestionId },
    });
    if (!suggestion) throw new NotFoundException('MessageSuggestion not found');

    const provider = this.providers[args.channel];
    const result = await provider.send({
      recipient: args.recipient,
      message: suggestion.personalizedMessage,
      subject: args.subject,
    });

    await this.prisma.assisteFinanceiroMessageDelivery.update({
      where: { id: deliveryId },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        status: result.status,
        externalId: result.externalId ?? delivery.externalId,
        errorMessage: result.error,
      },
    });

    return {
      success: result.success,
      deliveryId,
      externalId: result.externalId,
      status: result.status,
      error: result.error,
    };
  }

  async handleWebhook(channel: DeliveryChannel, payload: unknown): Promise<void> {
    const provider = this.providers[channel];
    const parsed = provider.parseWebhook(payload);
    if (!parsed) {
      this.logger.warn(`Unrecognized webhook payload for ${channel}`);
      return;
    }

    const delivery = await this.prisma.assisteFinanceiroMessageDelivery.findFirst({
      where: { externalId: parsed.externalId },
    });
    if (!delivery) {
      this.logger.warn(`Delivery not found for externalId ${parsed.externalId}`);
      return;
    }

    const updates: Record<string, unknown> = { status: parsed.status };
    if (parsed.status === 'delivered') updates.deliveredAt = new Date();
    if (parsed.status === 'read') updates.readAt = new Date();

    await this.prisma.assisteFinanceiroMessageDelivery.update({
      where: { id: delivery.id },
      data: updates,
    });
  }
}

