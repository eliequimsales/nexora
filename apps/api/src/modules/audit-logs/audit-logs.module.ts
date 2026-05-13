import { Module } from '@nestjs/common';
import { AuditLogController } from './audit-log.controller';
import { ActivityLogController } from './activity-log.controller';
import { AuditLogService } from './audit-log.service';
import { ActivityLogService } from './activity-log.service';

@Module({
  controllers: [AuditLogController, ActivityLogController],
  providers: [AuditLogService, ActivityLogService],
  exports: [AuditLogService, ActivityLogService],
})
export class AuditLogsModule {}
