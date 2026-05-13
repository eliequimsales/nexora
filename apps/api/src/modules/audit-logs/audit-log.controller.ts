import { Controller, Get, Query } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { RequirePermission } from '../../common/rbac/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @RequirePermission('audit-logs:read')
  findAll(
    @CurrentUser() ctx: TenantContext,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('resourceType') resourceType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLogService.findAll(ctx.orgId, {
      action,
      actorId,
      resourceType,
      from,
      to,
      page: Number(page) || 1,
      limit: Number(limit) || 30,
    });
  }
}
