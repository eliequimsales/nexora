import { Controller, Get, Param } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { RequirePermission } from '../../common/rbac/permissions';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  @Get()
  @RequirePermission('org:read')
  list() {
    return this.service.list();
  }

  @Get(':id')
  @RequirePermission('org:read')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
