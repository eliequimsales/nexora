import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { RequirePermission } from '../../common/rbac/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  @RequirePermission('leads:read')
  getSummary(@CurrentUser() ctx: TenantContext) {
    return this.service.getSummary(ctx);
  }

  @Get('activity')
  @RequirePermission('leads:read')
  getActivity(@CurrentUser() ctx: TenantContext) {
    return this.service.getActivity(ctx);
  }

  /**
   * Métricas específicas de Nexora — foco em recuperação de clientes.
   * Retorna dados para o dashboard Nexora (inativos, recuperados, receita estimada).
   */
  @Get('nexora-metrics')
  @RequirePermission('leads:read')
  getNexoraMetrics(@CurrentUser() ctx: TenantContext) {
    return this.service.getNexoraMetrics(ctx);
  }
}
