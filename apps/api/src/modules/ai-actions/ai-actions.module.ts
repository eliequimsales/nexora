import { Module } from '@nestjs/common';
import { AiActionsController } from './ai-actions.controller';
import { AiActionsService } from './ai-actions.service';
import { LlmService } from './llm.service';
import { PromptService } from './prompt.service';

@Module({
  controllers: [AiActionsController],
  providers: [AiActionsService, LlmService, PromptService],
  exports: [AiActionsService, LlmService],
})
export class AiActionsModule {}
