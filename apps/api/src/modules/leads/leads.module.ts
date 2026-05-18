import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { ClientRecoveryService } from './services/client-recovery.service';
import { LeadsImportService } from './services/leads-import.service';
import { AiActionsModule } from '../ai-actions/ai-actions.module';
import { AssistenteFinanceiroModule } from '../assistente-financeiro/assistente-financeiro.module';

@Module({
  imports: [AiActionsModule, AssistenteFinanceiroModule],
  controllers: [LeadsController],
  providers: [LeadsService, ClientRecoveryService, LeadsImportService],
  exports: [LeadsService, ClientRecoveryService],
})
export class LeadsModule {}
