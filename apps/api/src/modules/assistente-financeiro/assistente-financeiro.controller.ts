import { randomUUID } from 'crypto';
import { Controller, Post, Get, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { MessageGenerationService } from './services/message-generation.service';
import { AIMetricsService } from './services/ai-metrics.service';
import { RequirePermission } from '../../common/rbac/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { GenerateMessageRequest, GenerateMessageResponse, AIMetricsResponse, RecordFeedbackRequest, RecordFeedbackResponse } from './dtos/message.dtos';
import { RecordFeedbackRequestDto } from './dtos/message.dtos';
import type { TenantContext } from '../../common/tenant/tenant-context';

/**
 * Assistente Financeiro Controller
 *
 * Exposes API endpoints for AI-powered message generation and metrics tracking.
 * Handles personalized recovery message generation for churned customers.
 */
@Controller('assistente-financeiro')
export class AssistenteFinanceiroController {
  constructor(
    private readonly messageGenerationService: MessageGenerationService,
    private readonly aiMetricsService: AIMetricsService,
  ) {}

  /**
   * Generate a personalized recovery message
   * @param request - Customer data and recovery context
   * @param ctx - Tenant context. Required for tenant isolation and authorization
   * @returns GenerateMessageResponse with base and personalized messages
   */
  @Post('generate-message')
  @RequirePermission('assistente-financeiro:generate-message')
  async generateMessage(
    @Body() request: GenerateMessageRequest,
    @CurrentUser() ctx: TenantContext,
  ): Promise<GenerateMessageResponse> {
    return this.messageGenerationService.generateMessage(request, ctx);
  }

  /**
   * Get AI metrics for a subscription
   * @param subscriptionId - The subscription ID (UUID format)
   * @param ctx - Tenant context. Required for tenant isolation and authorization
   * @returns AI metrics including accuracy score and success rate
   */
  @Get('ai-metrics/:subscriptionId')
  @RequirePermission('assistente-financeiro:read-metrics')
  async getAIMetrics(
    @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string,
    @CurrentUser() ctx: TenantContext,
  ): Promise<AIMetricsResponse> {
    return this.aiMetricsService.getMetrics(subscriptionId);
  }

  /**
   * Record feedback about a sent message suggestion
   *
   * Tracks whether the customer responded to and/or returned due to the message.
   * This feedback feeds into the learning loop to improve future message generation.
   *
   * @param feedback - Feedback data including customer response and recovery info (validated by class-validator)
   * @param ctx - Tenant context. Required for tenant isolation and authorization
   * @returns RecordFeedbackResponse indicating success
   * @throws BadRequestException if validation fails (handled by class-validator)
   */
  @Post('message-feedback')
  @RequirePermission('assistente-financeiro:record-feedback')
  async recordMessageFeedback(
    @Body() feedback: RecordFeedbackRequestDto,
    @CurrentUser() ctx: TenantContext,
  ): Promise<RecordFeedbackResponse> {
    // TODO: Implement database persistence in Task 8
    // CRITICAL SECURITY: Must verify that messageSuggestionId belongs to current tenant
    // - Load suggestion from DB and verify: suggestion.customer.subscription.organizationId === ctx.organizationId
    // - Prevent cross-tenant feedback injection
    // - Create feedback record linked to both suggestion and tenant context
    // Future implementation will:
    // 1. Verify message suggestion belongs to current tenant
    // 2. Create feedback record in database
    // 3. Update message suggestion status
    // 4. Trigger learning loop to update AI metrics

    return {
      success: true,
      feedbackId: randomUUID(), // Placeholder - will be actual feedback ID from DB in Task 8
    };
  }
}
