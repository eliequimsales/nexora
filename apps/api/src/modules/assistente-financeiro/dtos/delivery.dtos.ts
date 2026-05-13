import { IsUUID, IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';

/**
 * Delivery channels exposed through the HTTP API.
 * Mirrors the `DeliveryChannel` type from the provider interface, but as an
 * enum so it can be used with class-validator's `IsEnum` decorator.
 */
export enum DeliveryChannelDto {
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
}

/**
 * Payload for `POST /messages/send`.
 * Validated at the HTTP boundary before being handed to the delivery service.
 */
export class SendMessageRequestDto {
  /** UUID of the previously generated message suggestion to dispatch. */
  @IsUUID('4', { message: 'messageSuggestionId must be a valid UUID' })
  messageSuggestionId!: string;

  /** Channel to deliver the message through. */
  @IsEnum(DeliveryChannelDto, {
    message: 'channel must be either "whatsapp" or "email"',
  })
  channel!: DeliveryChannelDto;

  /**
   * Recipient identifier:
   * - WhatsApp: E.164 phone number (e.g. +5511999999999)
   * - Email: RFC 5322 email address
   * Validation of channel-specific format is performed by the provider.
   */
  @IsString()
  @MaxLength(200)
  recipient!: string;

  /** Optional subject line (used by email channel). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;
}

/**
 * Response returned by `POST /messages/send`.
 * `deliveryId` is the internal tracking record id; `externalId` is the
 * id returned by the provider (Twilio SID, SendGrid message id, etc).
 */
export interface SendMessageResponse {
  success: boolean;
  deliveryId?: string;
  externalId?: string;
  status?: string;
  error?: string;
}

/**
 * Generic wrapper for inbound provider webhook payloads.
 * The concrete shape of `payload` is provider-specific and parsed by
 * the corresponding `MessageDeliveryProvider.parseWebhook`.
 */
export interface WebhookPayload {
  channel: 'whatsapp' | 'email';
  payload: unknown;
}

// ============================================================================
// message-delivery.service.ts content (to be extracted to separate file)
// ============================================================================
// FOR EXTRACTION:
// - Copy everything between these markers to services/message-delivery.service.ts
// - Remove the rest of this comment

/*
===== START: message-delivery.service.ts =====

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../database/prisma.service';
import { ZapiWhatsappProvider } from '../providers/zapi-whatsapp.provider';
import { ResendEmailProvider } from '../providers/resend-email.provider';
import { DeliveryRateLimiterService } from './delivery-rate-limiter.service';
import type { MessageDeliveryProvider, DeliveryChannel } from '../providers/message-delivery-provider.interface';

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
  // [Full implementation copied from delivery-rate-limiter.service.ts lines 47-177]
}

===== END: message-delivery.service.ts =====
*/
