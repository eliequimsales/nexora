import { Module } from '@nestjs/common';
import { NexoraReportService } from './nexora-report.service';
import { NexoraReportProcessor } from './nexora-report.processor';

/**
 * Nexora weekly retention email — scheduler + render + send.
 *
 * Depends on globally-provided PrismaService + ConfigService.
 * Uses RESEND_API_KEY directly (system-level, not per-tenant config).
 */
@Module({
  providers: [NexoraReportService, NexoraReportProcessor],
  exports: [NexoraReportService],
})
export class NexoraReportsModule {}
