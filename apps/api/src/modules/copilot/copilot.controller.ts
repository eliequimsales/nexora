import { Controller, Get, Post, Body } from '@nestjs/common';
import { CopilotService } from './copilot.service';
import { AskCopilotDto } from './dto/ask-copilot.dto';
import { RequirePermission } from '../../common/rbac/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Controller('copilot')
export class CopilotController {
  constructor(private readonly copilotService: CopilotService) {}

  @Get('suggestions')
  @RequirePermission('copilot:read')
  getSuggestions(@CurrentUser() ctx: TenantContext) {
    return this.copilotService.getSuggestions(ctx.orgId);
  }

  @Post('ask')
  @RequirePermission('copilot:read')
  ask(@Body() dto: AskCopilotDto, @CurrentUser() ctx: TenantContext) {
    return this.copilotService.ask(ctx.orgId, dto.question, dto.leadId);
  }
}
