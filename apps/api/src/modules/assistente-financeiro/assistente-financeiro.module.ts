import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService } from '../../database/prisma.service';
import { MessageGenerationService } from './services/message-generation.service';
import { AIMetricsService } from './services/ai-metrics.service';
import { MessageDeliveryService } from './services/message-delivery.service';
import { DeliveryRateLimiterService } from './services/delivery-rate-limiter.service';
import { AssistenteFinanceiroController } from './assistente-financeiro.controller';
import { AIRetrainingWorker } from './workers/ai-retraining.worker';
import { MessageDeliveryWorker } from './workers/message-delivery.worker';
import { ZapiWhatsappProvider } from './providers/zapi-whatsapp.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';

/**
 * Assistente Financeiro Module
 *
 * Manages AI-powered financial assistance, customer churn recovery,
 * and goal tracking for the SaaS platform.
 *
 * Features:
 * - Customer churn analysis and prediction
 * - Recovery action suggestions and tracking
 * - Integration with external CRMs (Pipedrive, etc)
 * - Monthly metrics and analytics
 * - AI learning and model improvement
 * - Personalized message generation using Claude API
 * - Weekly automated retraining via AIRetrainingWorker
 */
@Module({
  imports: [ConfigModule, ScheduleModule.forRoot(), BullModule.registerQueue({ name: 'message-delivery' })],
  controllers: [AssistenteFinanceiroController],
  providers: [PrismaService, MessageGenerationService, AIMetricsService, MessageDeliveryService, DeliveryRateLimiterService, AIRetrainingWorker, MessageDeliveryWorker, ZapiWhatsappProvider, ResendEmailProvider],
  exports: [PrismaService, MessageGenerationService, AIMetricsService, MessageDeliveryService, DeliveryRateLimiterService, AIRetrainingWorker, MessageDeliveryWorker, ZapiWhatsappProvider, ResendEmailProvider],
})
export class AssistenteFinanceiroModule {}
