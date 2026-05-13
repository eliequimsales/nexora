import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [IntegrationsModule, AuditLogsModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
