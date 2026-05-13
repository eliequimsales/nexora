import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { MessageGenerationService } from './services/message-generation.service';
import { AIMetricsService } from './services/ai-metrics.service';
import { AssistenteFinanceiroController } from './assistente-financeiro.controller';
import { AIRetrainingWorker } from './workers/ai-retraining.worker';

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
  imports: [ConfigModule, ScheduleModule.forRoot()],
  controllers: [AssistenteFinanceiroController],
  providers: [PrismaService, MessageGenerationService, AIMetricsService, AIRetrainingWorker],
  exports: [PrismaService, MessageGenerationService, AIMetricsService, AIRetrainingWorker],
})
export class AssistenteFinanceiroModule {}
