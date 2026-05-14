import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { RequirePermission } from '../../common/rbac/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlanLimit } from '../../common/guards/plan-limits.guard';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @RequirePermission('leads:create')
  @PlanLimit('leads')
  create(@Body() dto: CreateLeadDto, @CurrentUser() ctx: TenantContext) {
    return this.leadsService.create(dto, ctx);
  }

  @Get()
  @RequirePermission('leads:read')
  findAll(@Query() params: ListLeadsDto, @CurrentUser() ctx: TenantContext) {
    return this.leadsService.findAll(params, ctx);
  }

  /**
   * List inactive clients (leads not touched in the last N days, excluding closed/archived).
   * Used by the Nexora recovery screen.
   * Must come before `:id` route so "inactive" isn't matched as a UUID param.
   */
  @Get('inactive')
  @RequirePermission('leads:read')
  async getInactiveClients(
    @CurrentUser() ctx: TenantContext,
    @Query('days') days?: string,
  ) {
    const parsed = Number(days);
    const threshold = Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
    return this.leadsService.findInactive(ctx, threshold);
  }

  @Get(':id')
  @RequirePermission('leads:read')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() ctx: TenantContext) {
    return this.leadsService.findOne(id, ctx);
  }

  @Patch(':id')
  @RequirePermission('leads:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() ctx: TenantContext,
  ) {
    return this.leadsService.update(id, dto, ctx);
  }

  @Delete(':id')
  @RequirePermission('leads:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() ctx: TenantContext) {
    return this.leadsService.archive(id, ctx);
  }
}
