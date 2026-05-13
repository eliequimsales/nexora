/**
 * Message Delivery Provider Interface
 *
 * Abstract contract for sending recovery messages via external channels
 * (WhatsApp, Email, SMS, etc). Each concrete provider implements `send`
 * to push a message and `parseWebhook` to translate provider-specific
 * delivery callbacks into a canonical `DeliveryStatus`.
 */

/** Supported delivery channels for outbound recovery messages. */
export type DeliveryChannel = 'whatsapp' | 'email';

/** Canonical delivery lifecycle states for a sent message. */
export type DeliveryStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'bounced';

/**
 * Payload accepted by `MessageDeliveryProvider.send`.
 * Channel-specific fields (e.g. `subject` for email) are optional.
 */
export interface DeliveryRequest {
  /** Recipient identifier (phone number for WhatsApp, email address for Email). */
  recipient: string;

  /** Message body to deliver (already personalized by the AI pipeline). */
  message: string;

  /** Optional subject line, used by channels that support it (e.g. email). */
  subject?: string;

  /** Free-form provider metadata propagated for tracing/correlation. */
  metadata?: Record<string, unknown>;
}

/**
 * Standardized result returned by every provider after `send`.
 * `retryable` signals whether the caller should re-enqueue on failure.
 */
export interface DeliveryResult {
  success: boolean;
  externalId?: string;
  status: DeliveryStatus;
  error?: string;
  retryable?: boolean;
}

/**
 * Contract every channel-specific delivery provider must implement.
 */
export interface MessageDeliveryProvider {
  /** Channel served by this provider (used for registry lookup). */
  readonly channel: DeliveryChannel;

  /** Sends a message via the underlying transport and returns a canonical result. */
  send(request: DeliveryRequest): Promise<DeliveryResult>;

  /**
   * Translates a raw provider webhook payload into a canonical status update.
   * Returns `null` when the payload is not recognized or cannot be parsed.
   */
  parseWebhook(payload: unknown): { externalId: string; status: DeliveryStatus } | null;
}

/*
TODO: MessageDeliveryService implementation will be in ./services/message-delivery.service.ts
The service orchestrates send(), retry(), and handleWebhook() operations.
*/
