import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NexoraReportService } from './nexora-report.service';

/**
 * Schedules the weekly Nexora retention email.
 *
 * Runs Monday at 08:00 in the system's local timezone. The container's TZ
 * should be set to America/Sao_Paulo in production deploy config so this hits
 * Brazilian business hours.
 *
 * Cron expression: `0 8 * * 1` = at 08:00 on Monday.
 */
@Injectable()
export class NexoraReportProcessor {
  private readonly logger = new Logger(NexoraReportProcessor.name);

  constructor(private readonly reportService: NexoraReportService) {}

  @Cron('0 8 * * 1', { name: 'nexora-weekly-report' })
  async runWeekly(): Promise<void> {
    this.logger.log('Triggering weekly Nexora report distribution...');
    const result = await this.reportService.sendAllWeeklyReports();
    this.logger.log(
      `Weekly report done — sent=${result.sent}, skipped=${result.skipped}`,
    );
  }
}
