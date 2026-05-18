import { Controller, Get, Patch, Post, Body } from '@nestjs/common';
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
}
