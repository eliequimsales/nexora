import { Controller, Get, Patch, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { UpdateStageDto } from './dto/update-stage.dto';
import { RequirePermission } from '../../common/rbac/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get('board')
  @RequirePermission('pipeline:read')
  getBoard(@CurrentUser() ctx: TenantContext) {
    return this.pipelineService.getBoard(ctx);
  }

  @Patch('stages/:id')
  @RequirePermission('pipeline:manage')
  updateStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStageDto,
    @CurrentUser() ctx: TenantContext,
  ) {
    return this.pipelineService.updateStage(id, dto, ctx);
  }
}
