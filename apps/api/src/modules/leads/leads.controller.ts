import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import { ClientRecoveryService, type RecoveryChannel } from './services/client-recovery.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { RecoverClientDto } from './dto/recover-client.dto';
import { BatchRecoverDto } from './dto/batch-recover.dto';
import { ConfirmRecoveryDto } from './dto/confirm-recovery.dto';
import { RequirePermission } from '../../common/rbac/permissions';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlanLimit } from '../../common/guards/plan-limits.guard';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly recoveryService: ClientRecoveryService,
  ) {}

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

  /**
   * Dispara a recuperação de um cliente inativo via IA + canal de mensagem.
   * O backend gera o texto, envia pelo provider e registra ActivityLog.
   */
  @Post(':id/recuperar')
  @RequirePermission('leads:update')
  recoverClient(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RecoverClientDto,
    @CurrentUser() ctx: TenantContext,
  ) {
    return this.recoveryService.recover(id, ctx, body.channel as RecoveryChannel | undefined);
  }

  /**
   * Recuperação em lote — envia mensagens de recuperação para múltiplos clientes.
   * Processa até 100 leads por chamada. Não para na primeira falha.
   */
  @Post('batch-recover')
  @RequirePermission('leads:update')
  batchRecover(
    @Body() body: BatchRecoverDto,
    @CurrentUser() ctx: TenantContext,
  ) {
    return this.recoveryService.batchRecover(
      body.leadIds,
      ctx,
      body.channels as RecoveryChannel[] | undefined,
    );
  }

  /**
   * Confirma que um cliente recuperado voltou e pagou.
   * Body: { value: number } — valor real em R$ gasto pelo cliente.
   *
   * Este é o evento que alimenta o KPI "Receita Recuperada" — o número que
   * justifica a assinatura mensal aos olhos do barbeiro.
   */
  @Post(':id/confirm-recovery')
  @RequirePermission('leads:update')
  confirmRecovery(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ConfirmRecoveryDto,
    @CurrentUser() ctx: TenantContext,
  ) {
    return this.recoveryService.confirmRecovery(id, body.value, ctx);
  }

  /**
   * Webhook público — recebe respostas inbound de clientes.
   *
   * Provider (Z-API ou Resend) envia { channel, from, message } e o backend
   * busca a recovery_sent mais recente do lead, marcando-a como respondida.
   *
   * Não recebe org-id na payload — o tenant é inferido pelo lead encontrado
   * via phone/email. Idempotente.
   */
  @Public()
  @Post('webhooks/response')
  @HttpCode(HttpStatus.OK)
  async handleResponseWebhook(
    @Body() body: { channel: 'whatsapp' | 'email'; from: string; message: string },
  ) {
    if (!body?.from || !body?.message || !body?.channel) {
      return { ok: false, matched: false };
    }
    const result = await this.recoveryService.markResponseReceived({
      channel: body.channel,
      fromIdentifier: body.from,
      responseText: body.message,
    });
    return { ok: true, ...result };
  }

  @Delete(':id')
  @RequirePermission('leads:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() ctx: TenantContext) {
    return this.leadsService.archive(id, ctx);
  }
}
