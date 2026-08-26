import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { AssisteFinanceiroCustomer } from '../models/customer.model';
import type {
  GenerateMessageRequest,
  GenerateMessageResponse,
  ParsedClaudeResponse,
  MessageContext,
} from '../dtos/message.dtos';

/**
 * MessageGenerationService
 *
 * Generates personalized recovery messages using Claude API.
 * Supports multiple channels (WhatsApp, Email) with appropriate formatting.
 * Includes graceful fallbacks when Claude API fails.
 */
@Injectable()
export class MessageGenerationService {
  private readonly logger = new Logger(MessageGenerationService.name);
  private readonly client: Anthropic;
  private readonly apiKey: string;
  private readonly model = 'claude-3-5-sonnet-20241022';
  private readonly maxTokens = 1024;
  private readonly timeoutMs = 10000;

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject('ANTHROPIC_CLIENT') client?: Anthropic,
  ) {
    this.apiKey = this.configService.get<string>('llm.apiKey') || '';

    // Use injected client if available (for testing), otherwise create new one
    if (client) {
      this.client = client;
    } else if (this.apiKey) {
      this.client = new Anthropic({ apiKey: this.apiKey });
    } else {
      this.logger.warn(
        'ANTHROPIC_API_KEY not configured. Message generation will use fallbacks.',
      );
      this.client = null as any;
    }
  }

  /**
   * Generate a personalized recovery message for a customer
   *
   * @param request - Request containing customer, channel, context
   * @param ctx - Optional tenant context for logging and audit
   * @returns Response with base and personalized messages
   *
   * Never throws. Always returns a valid response, falling back gracefully
   * if Claude API fails.
   */
  async generateMessage(
    request: GenerateMessageRequest,
    ctx?: any,
  ): Promise<GenerateMessageResponse> {
    try {
      // If no API key configured, use generic message
      if (!this.apiKey || !this.client) {
        this.logger.debug('No API key configured, using generic message');
        return this.getGenericMessage(
          request.customer,
          request.channel,
          request.context,
        );
      }

      // Build prompt with all context
      const prompt = this.buildPrompt(
        request.customer,
        request.channel,
        request.recoveryProbability,
        request.context,
      );

      // Call Claude API with timeout
      let timeoutHandle: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error('Claude API timeout')),
          this.timeoutMs,
        );
      });

      let response: Anthropic.Message;
      try {
        response = (await Promise.race([
          this.client.messages.create({
            model: this.model,
            max_tokens: this.maxTokens,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          }),
          timeout,
        ])) as Anthropic.Message;
      } finally {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      }

      // Extract text from response
      const content = response.content[0];
      if (content.type !== 'text') {
        this.logger.warn(
          'Unexpected Claude response type. Using generic message.',
        );
        return this.getGenericMessage(
          request.customer,
          request.channel,
          request.context,
        );
      }

      // Parse JSON response
      const parsed = this.parseResponse(content.text, request.channel);

      // Return successful response
      return {
        baseMessage: parsed.baseMessage,
        personalizedMessage: parsed.personalizedMessage,
        channel: request.channel,
        confidence: parsed.confidence,
        contextData: {
          daysSinceLastPurchase: request.context.daysSinceLastPurchase,
          recoveryProbability: request.recoveryProbability,
          customerRevenue: request.customer.totalRevenue,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error generating message: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Fallback to generic message
      return this.getGenericMessage(
        request.customer,
        request.channel,
        request.context,
      );
    }
  }

  /**
   * Build Claude prompt with customer context and channel-specific instructions
   *
   * @param customer - Customer object with name, revenue, etc
   * @param channel - 'whatsapp' or 'email'
   * @param recoveryProbability - Estimated success probability (0-100)
   * @param context - Historical and behavioral context
   * @returns Formatted prompt string for Claude
   */
  buildPrompt(
    customer: AssisteFinanceiroCustomer,
    channel: 'whatsapp' | 'email',
    recoveryProbability: number,
    context: MessageContext,
  ): string {
    const daysSinceActivity = context.daysSinceLastPurchase || 0;
    const avgRevenue = context.avgMonthlyRevenue || 0;
    const lastPurchase = context.lastPurchaseValue || 0;

    const channelInstructions =
      channel === 'whatsapp'
        ? 'Brief (max 2-3 lines), casual tone, include 1-2 emojis, use informal language'
        : 'Professional tone, 3-5 sentences, structure with greeting + reason + call-to-action, no emojis';

    const prompt = `You are a customer recovery specialist helping re-engage inactive customers.

Generate a personalized recovery message for this customer:

**Customer Details:**
- Name: ${customer.name}
- Email: ${customer.email}
- Total Revenue: R$ ${customer.totalRevenue}
- Days Since Last Activity: ${daysSinceActivity}
- Churn Risk Score: ${customer.churnRiskScore}/100
- Average Monthly Revenue: R$ ${avgRevenue}
- Last Purchase Value: R$ ${lastPurchase}

**Recovery Context:**
- Estimated recovery probability: ${recoveryProbability}%
- Target Channel: ${channel}
- Channels used before: ${context.channelHistory?.join(', ') || 'Not specified'}

**Message Requirements for ${channel}:**
${channelInstructions}

Generate two versions:
1. **baseMessage**: Generic recovery message (no personalization, channel-appropriate)
2. **personalizedMessage**: Same message but with customer's name and revenue context included

Also provide:
3. **confidence**: Your confidence (0-100) that this message will re-engage the customer

Respond with ONLY valid JSON (no markdown, no extra text):
{
  "baseMessage": "...",
  "personalizedMessage": "...",
  "confidence": <number>
}`;

    return prompt;
  }

  /**
   * Parse Claude API response and extract message data
   * Handles malformed JSON gracefully
   *
   * @param response - Raw text response from Claude
   * @param channel - Channel context for fallback
   * @returns Parsed response with base message, personalized message, confidence
   */
  parseResponse(
    response: string,
    channel: 'whatsapp' | 'email',
  ): ParsedClaudeResponse {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('No JSON found in Claude response');
        return this.getDefaultMessage(channel);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (
        !parsed.baseMessage ||
        !parsed.personalizedMessage ||
        typeof parsed.confidence !== 'number'
      ) {
        this.logger.warn('Parsed response missing required fields');
        return this.getDefaultMessage(channel);
      }

      // Ensure confidence is in valid range
      const confidence = Math.max(0, Math.min(100, parsed.confidence));

      return {
        baseMessage: parsed.baseMessage.trim(),
        personalizedMessage: parsed.personalizedMessage.trim(),
        confidence,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to parse Claude response: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.getDefaultMessage(channel);
    }
  }

  /**
   * Get generic message as fallback (includes name personalization)
   * Used when Claude API fails or is not configured
   *
   * @param customer - Customer object
   * @param channel - 'whatsapp' or 'email'
   * @param context - Message context
   * @returns Generic response with fallback messages
   */
  getGenericMessage(
    customer: AssisteFinanceiroCustomer,
    channel: 'whatsapp' | 'email',
    context: MessageContext,
  ): GenerateMessageResponse {
    const defaultMsg = this.getDefaultMessage(channel);
    const daysSince = context.daysSinceLastPurchase || 0;

    // Add name personalization to default message
    let personalizedMsg = defaultMsg.personalizedMessage;

    if (customer.name) {
      // Replace generic placeholder with actual name
      personalizedMsg = defaultMsg.personalizedMessage.replace(
        /\[Nome\]|Customer/gi,
        customer.name,
      );

      // If no placeholder was replaced, prepend name
      if (personalizedMsg === defaultMsg.personalizedMessage) {
        if (channel === 'whatsapp') {
          personalizedMsg = `Olá ${customer.name}! ${personalizedMsg}`;
        } else {
          personalizedMsg = `Olá ${customer.name},\n\n${personalizedMsg}`;
        }
      }
    }

    return {
      baseMessage: defaultMsg.baseMessage,
      personalizedMessage: personalizedMsg,
      channel,
      confidence: 35, // Low confidence for fallback
      contextData: {
        daysSinceLastPurchase: daysSince,
        source: 'fallback',
      },
    };
  }

  /**
   * Get hardcoded default message for emergency fallback
   * Used when all else fails (no API key, parse errors, etc)
   *
   * @param channel - 'whatsapp' or 'email'
   * @returns Default messages for the channel
   */
  getDefaultMessage(channel: 'whatsapp' | 'email'): ParsedClaudeResponse {
    if (channel === 'whatsapp') {
      return {
        baseMessage:
          'Oi! Não vemos você há um tempo. Queremos saber como está! 👋',
        personalizedMessage:
          'Oi [Nome]! Não vemos você há um tempo. Queremos saber como está! 👋 Estamos aqui pra ajudar.',
        confidence: 30,
      };
    } else {
      // email
      return {
        baseMessage:
          'Olá,\n\nNotamos que você não interage conosco há um tempo. Gostaríamos de saber como estão as coisas e como podemos ajudar.\n\nUm abraço,\nNosso Time',
        personalizedMessage:
          'Olá [Nome],\n\nNotamos que você não interage conosco há um tempo. Gostaríamos de saber como estão as coisas e como podemos ajudá-lo melhor.\n\nUm abraço,\nNosso Time',
        confidence: 30,
      };
    }
  }
}
