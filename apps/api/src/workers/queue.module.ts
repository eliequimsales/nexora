import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WorkflowProcessor } from './workflow.processor';
import { WebhookProcessor } from './webhook.processor';
import { ScheduledProcessor } from './scheduled.processor';
import { QueueStatsController } from './queue-stats.controller';
import { WorkflowsModule } from '../modules/workflows/workflows.module';
import { IntegrationsModule } from '../modules/integrations/integrations.module';
import { AiActionsModule } from '../modules/ai-actions/ai-actions.module';
import { QUEUE_NAMES } from '@nexora/shared';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.WORKFLOWS },
      { name: QUEUE_NAMES.WEBHOOKS },
      { name: QUEUE_NAMES.SCHEDULED_JOBS },
    ),
    WorkflowsModule,
    IntegrationsModule,
    AiActionsModule,
  ],
  controllers: [QueueStatsController],
  providers: [WorkflowProcessor, WebhookProcessor, ScheduledProcessor],
})
export class QueueModule {}
