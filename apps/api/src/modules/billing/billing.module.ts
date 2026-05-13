import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PlanLimitsService } from '../../common/billing/plan-limits.service';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [DatabaseModule],
  providers: [BillingService, PlanLimitsService],
  controllers: [BillingController],
  exports: [PlanLimitsService],
})
export class BillingModule {}
