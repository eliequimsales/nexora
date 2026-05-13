import { Body, Controller, Get, NotFoundException, Post, Query } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { RequirePermission } from '../../common/rbac/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Controller('activity-logs')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  @RequirePermission('activity-logs:read')
  findAll(
    @CurrentUser() ctx: TenantContext,
    @Query('leadId') leadId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Number(page) || 1;
    const l = Number(limit) || 20;

    if (leadId) {
      return this.activityLogService.findByLead(ctx.orgId, leadId, p, l);
    }

    return this.activityLogService.findByOrg(ctx.orgId, p, l);
  }

  @Post('notes')
  @RequirePermission('leads:update')
  async createNote(@CurrentUser() ctx: TenantContext, @Body() dto: CreateNoteDto) {
    try {
      return await this.activityLogService.createNote(ctx.orgId, dto.leadId, ctx.userId, dto.content);
    } catch {
      throw new NotFoundException('Lead não encontrado');
    }
  }
}
