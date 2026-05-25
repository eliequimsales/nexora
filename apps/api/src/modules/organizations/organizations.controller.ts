import { Controller, Get, Patch, Post, Delete, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { OrganizationsService } from './organizations.service';
import { UpdateOrgDto } from './dto/update-org.dto';
import { ApplyTemplateDto } from './dto/apply-template.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { RequirePermission } from '../../common/rbac/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Get('me')
  @RequirePermission('org:read')
  getOwn(@CurrentUser() ctx: TenantContext) {
    return this.service.findOwn(ctx);
  }

  @Patch('me')
  @RequirePermission('org:update')
  update(@CurrentUser() ctx: TenantContext, @Body() dto: UpdateOrgDto) {
    return this.service.update(ctx, dto);
  }

  @Post('current/apply-template')
  @RequirePermission('org:update')
  applyTemplate(@CurrentUser() ctx: TenantContext, @Body() dto: ApplyTemplateDto) {
    return this.service.applyTemplate(ctx, dto.templateId);
  }

  @Patch('current/onboarding')
  @RequirePermission('org:update')
  updateOnboarding(@CurrentUser() ctx: TenantContext, @Body() dto: UpdateOnboardingDto) {
    return this.service.updateOnboarding(ctx, dto);
  }

  /**
   * Marca o aceite do termo LGPD da organização.
   * Sem esse aceite, todas as rotas de envio (recover, batch-recover, preview)
   * retornam 403. Versionado para permitir re-aceite quando o termo mudar.
   */
  @Post('current/lgpd-accept')
  @RequirePermission('org:update')
  acceptLgpd(@CurrentUser() ctx: TenantContext) {
    return this.service.acceptLgpdTerm(ctx);
  }

  /**
   * LGPD Art. 18 — portabilidade de dados.
   * Retorna um JSON com todos os dados da organização para download.
   */
  @Get('current/export-data')
  @RequirePermission('org:read')
  async exportData(@CurrentUser() ctx: TenantContext, @Res() res: Response) {
    const data = await this.service.exportData(ctx);
    const filename = `nexora-dados-${new Date().toISOString().split('T')[0]}.json`;
    res
      .setHeader('Content-Type', 'application/json')
      .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      .json(data);
  }

  /**
   * LGPD Art. 18 — eliminação de dados.
   * Registra solicitação de exclusão da conta (soft-delete).
   * Hard-delete é processado por job após 30 dias de retenção legal.
   */
  @Delete('current')
  @RequirePermission('org:delete')
  requestDeletion(@CurrentUser() ctx: TenantContext) {
    return this.service.requestDeletion(ctx);
  }
}
