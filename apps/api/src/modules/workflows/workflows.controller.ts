import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { RequirePermission } from '../../common/rbac/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post()
  @RequirePermission('workflows:manage')
  create(@Body() dto: CreateWorkflowDto, @CurrentUser() ctx: TenantContext) {
    return this.workflowsService.create(dto, ctx);
  }

  @Get()
  @RequirePermission('workflows:read')
  findAll(@CurrentUser() ctx: TenantContext) {
    return this.workflowsService.findAll(ctx);
  }

  @Get(':id')
  @RequirePermission('workflows:read')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() ctx: TenantContext) {
    return this.workflowsService.findOne(id, ctx);
  }

  @Patch(':id')
  @RequirePermission('workflows:manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowDto,
    @CurrentUser() ctx: TenantContext,
  ) {
    return this.workflowsService.update(id, dto, ctx);
  }

  @Delete(':id')
  @RequirePermission('workflows:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() ctx: TenantContext) {
    return this.workflowsService.remove(id, ctx);
  }

  @Get(':id/executions')
  @RequirePermission('workflows:read')
  getExecutions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @CurrentUser() ctx: TenantContext,
  ) {
    return this.workflowsService.getExecutions(id, ctx, Number(page) || 1, Number(limit) || 20);
  }
}
