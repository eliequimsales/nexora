import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { WorkflowEngine } from './workflow.engine';
import { AiActionsModule } from '../ai-actions/ai-actions.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { QUEUE_NAMES } from '@nexora/shared';

@Module({
  imports: [
    AiActionsModule,
    AuditLogsModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.WORKFLOWS }),
  ],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, WorkflowEngine],
  exports: [WorkflowsService, WorkflowEngine],
})
export class WorkflowsModule {}
