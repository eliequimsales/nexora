import { Controller, Get, Param } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { RequirePermission } from '../../common/rbac/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  @Get()
  @RequirePermission('org:read')
  list(@CurrentUser() user: TenantContext) {
    // Filtra templates pelo niche da organização do usuário
    return this.service.listByOrg(user.orgId);
  }

  @Get(':id')
  @RequirePermission('org:read')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
