import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus,
  ParseBoolPipe,
} from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { ChannelService } from './channel.service';
import { SaveConfigDto } from './dto/save-config.dto';
import { SaveWebhookDto } from './dto/save-webhook.dto';
import { RequirePermission } from '../../common/rbac/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly channelService: ChannelService,
  ) {}

  // ── Configs ──────────────────────────────────────────────────────────────────

  @Get('configs')
  @RequirePermission('integrations:read')
  getConfigs(@CurrentUser() ctx: TenantContext) {
    return this.integrationsService.getConfigs(ctx.orgId);
  }

  @Post('configs')
  @RequirePermission('integrations:manage')
  saveConfig(@Body() dto: SaveConfigDto, @CurrentUser() ctx: TenantContext) {
    return this.integrationsService.saveConfig(ctx.orgId, dto);
  }

  @Patch('configs/:channel/toggle')
  @RequirePermission('integrations:manage')
  toggleConfig(
    @Param('channel') channel: string,
    @Body('isActive', ParseBoolPipe) isActive: boolean,
    @CurrentUser() ctx: TenantContext,
  ) {
    return this.integrationsService.toggleConfig(ctx.orgId, channel, isActive);
  }

  @Delete('configs/:channel')
  @RequirePermission('integrations:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteConfig(@Param('channel') channel: string, @CurrentUser() ctx: TenantContext) {
    return this.integrationsService.deleteConfig(ctx.orgId, channel);
  }

  @Post('configs/:channel/test')
  @RequirePermission('integrations:read')
  testChannel(
    @Param('channel') channel: 'whatsapp' | 'email',
    @CurrentUser() ctx: TenantContext,
  ) {
    return this.channelService.testChannel(ctx.orgId, channel);
  }

  // ── Webhooks ─────────────────────────────────────────────────────────────────

  @Get('webhooks')
  @RequirePermission('integrations:read')
  getWebhooks(@CurrentUser() ctx: TenantContext) {
    return this.integrationsService.getWebhooks(ctx.orgId);
  }

  @Post('webhooks')
  @RequirePermission('integrations:manage')
  createWebhook(@Body() dto: SaveWebhookDto, @CurrentUser() ctx: TenantContext) {
    return this.integrationsService.createWebhook(ctx.orgId, dto);
  }

  @Patch('webhooks/:id')
  @RequirePermission('integrations:manage')
  updateWebhook(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<SaveWebhookDto>,
    @CurrentUser() ctx: TenantContext,
  ) {
    return this.integrationsService.updateWebhook(ctx.orgId, id, dto);
  }

  @Delete('webhooks/:id')
  @RequirePermission('integrations:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWebhook(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() ctx: TenantContext) {
    return this.integrationsService.deleteWebhook(ctx.orgId, id);
  }

  // ── Logs ─────────────────────────────────────────────────────────────────────

  @Get('logs')
  @RequirePermission('integrations:read')
  getLogs(
    @CurrentUser() ctx: TenantContext,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.integrationsService.getLogs(
      ctx.orgId,
      channel,
      status,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 30,
    );
  }
}
