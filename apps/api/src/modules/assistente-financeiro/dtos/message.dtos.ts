import { IsUUID, IsOptional, IsBoolean, IsISO8601, IsNumber, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { AssisteFinanceiroCustomer } from '../models/customer.model';

/**
 * Context for message generation
 * Contains historical and behavioral data about the customer
 */
export interface MessageContext {
  /** Days since the customer's last purchase or interaction */
  daysSinceLastPurchase: number;

  /** Average monthly revenue from this customer (optional) */
  avgMonthlyRevenue?: number;

  /** Value of the customer's last purchase (optional) */
  lastPurchaseValue?: number;

  /** Channels through which this customer has been contacted (optional) */
  channelHistory?: string[];

  /** Additional metadata (optional) */
  [key: string]: any;
}

/**
 * Request to generate a personalized recovery message
 */
export interface GenerateMessageRequest {
  /** Customer data including name, revenue, activity date, churn risk */
  customer: AssisteFinanceiroCustomer;

  /** Target channel for the message: 'whatsapp' or 'email' */
  channel: 'whatsapp' | 'email';

  /** Estimated probability (0-100) that this recovery message will succeed */
  recoveryProbability: number;

  /** Additional context about the customer */
  context: MessageContext;
}

/**
 * Response from message generation
 */
export interface GenerateMessageResponse {
  /** Generic base message (channel-appropriate, no personalization) */
  baseMessage: string;

  /** Personalized message with customer name and context */
  personalizedMessage: string;

  /** Channel used for generation */
  channel: 'whatsapp' | 'email';

  /** Confidence score (0-100) on how likely this message will succeed */
  confidence: number;

  /** Metadata used for message generation */
  contextData?: any;
}

/**
 * Internal structure for parsed Claude API response
 */
export interface ParsedClaudeResponse {
  baseMessage: string;
  personalizedMessage: string;
  confidence: number;
}

/**
 * AI metrics response for a subscription
 */
export interface AIMetricsResponse {
  subscriptionId: string;
  customersAnalyzed: number;
  totalSuggestions: number;
  successfulSuggestions: number;
  accuracyScore: number; // 0-100
  successRate: number; // 0-100
}

/**
 * Request to record feedback about a message suggestion
 * Tracks the outcomes of sent recovery messages for learning loop
 */
export interface RecordFeedbackRequest {
  /** UUID of the message suggestion that was sent */
  messageSuggestionId: string;

  /** Did the customer respond to the message? */
  customerResponded?: boolean;

  /** When did the customer respond? (ISO 8601 format) */
  responseAt?: string;

  /** Did the customer return/make a purchase? */
  customerReturned?: boolean;

  /** When did the customer return? (ISO 8601 format) */
  returnedAt?: string;

  /** Revenue recovered from this customer (optional) */
  revenueRecovered?: number;

  /** Additional notes about the feedback */
  notes?: string;
}

/**
 * Response when recording feedback
 */
export interface RecordFeedbackResponse {
  /** Whether the feedback was recorded successfully */
  success: boolean;

  /** Feedback ID if successfully recorded */
  feedbackId?: string;

  /** Error message if recording failed */
  error?: string;
}

/**
 * DTO for recording feedback about a message suggestion (with validation)
 * Replaces interface version with class-validator decorators
 */
export class RecordFeedbackRequestDto {
  /** UUID of the message suggestion that was sent */
  @IsUUID('4', { message: 'messageSuggestionId must be a valid UUID' })
  messageSuggestionId!: string;

  /** Did the customer respond to the message? */
  @IsOptional()
  @IsBoolean()
  customerResponded?: boolean;

  /** When did the customer respond? (ISO 8601 format) */
  @IsOptional()
  @IsISO8601({ strict: true })
  responseAt?: string;

  /** Did the customer return/make a purchase? */
  @IsOptional()
  @IsBoolean()
  customerReturned?: boolean;

  /** When did the customer return? (ISO 8601 format) */
  @IsOptional()
  @IsISO8601({ strict: true })
  returnedAt?: string;

  /** Revenue recovered from this customer (optional) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'revenueRecovered must be >= 0' })
  revenueRecovered?: number;

  /** Additional notes about the feedback */
  @IsOptional()
  @IsString()
  notes?: string;
}
