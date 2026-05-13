import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { RequirePermission } from '../../common/rbac/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Post()
  @RequirePermission('proposals:manage')
  create(@Body() dto: CreateProposalDto, @CurrentUser() ctx: TenantContext) {
    return this.proposalsService.create(dto, ctx);
  }

  @Get()
  @RequirePermission('proposals:read')
  findAll(
    @CurrentUser() ctx: TenantContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('leadId') leadId?: string,
  ) {
    return this.proposalsService.findAll(ctx, Number(page) || 1, Number(limit) || 20, status, leadId);
  }

  @Get(':id')
  @RequirePermission('proposals:read')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() ctx: TenantContext) {
    return this.proposalsService.findOne(id, ctx.orgId);
  }

  @Patch(':id')
  @RequirePermission('proposals:manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProposalDto,
    @CurrentUser() ctx: TenantContext,
  ) {
    return this.proposalsService.update(id, dto, ctx);
  }

  @Delete(':id')
  @RequirePermission('proposals:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() ctx: TenantContext) {
    return this.proposalsService.archive(id, ctx.orgId);
  }

  @Post(':id/send')
  @RequirePermission('proposals:manage')
  send(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() ctx: TenantContext) {
    return this.proposalsService.send(id, ctx.orgId);
  }

  @Post(':id/duplicate')
  @RequirePermission('proposals:manage')
  duplicate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() ctx: TenantContext) {
    return this.proposalsService.duplicate(id, ctx);
  }
}
