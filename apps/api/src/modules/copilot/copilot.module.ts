import { Module } from '@nestjs/common';
import { AiActionsModule } from '../ai-actions/ai-actions.module';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';

@Module({
  imports: [AiActionsModule],
  controllers: [CopilotController],
  providers: [CopilotService],
})
export class CopilotModule {}
