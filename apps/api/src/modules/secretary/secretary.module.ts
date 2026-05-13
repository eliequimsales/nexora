import { Module } from '@nestjs/common';
import { SecretaryService } from './secretary.service';
import { AiActionsModule } from '../ai-actions/ai-actions.module';

@Module({
  imports: [AiActionsModule],
  providers: [SecretaryService],
})
export class SecretaryModule {}
