import { Controller, Get, Patch, Post, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { RequirePermission } from '../../common/rbac/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  // ── Own profile ────────────────────────────────────────────────────────────

  @Get('me')
  @RequirePermission('users:read')
  getProfile(@CurrentUser() ctx: TenantContext) {
    return this.service.getProfile(ctx);
  }

  @Patch('me')
  @RequirePermission('users:read')
  updateProfile(@CurrentUser() ctx: TenantContext, @Body() dto: UpdateProfileDto) {
    return this.service.updateProfile(ctx, dto);
  }

  // ── Team management ────────────────────────────────────────────────────────

  @Get()
  @RequirePermission('users:list')
  findAll(@CurrentUser() ctx: TenantContext, @Query() query: ListUsersDto) {
    return this.service.findAll(ctx, query);
  }

  @Get(':id')
  @RequirePermission('users:read')
  findOne(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.service.findOne(ctx, id);
  }

  @Patch(':id')
  @RequirePermission('users:update')
  update(
    @CurrentUser() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.service.update(ctx, id, dto);
  }

  // ── Invite ─────────────────────────────────────────────────────────────────

  @Post('invite')
  @RequirePermission('users:invite')
  @HttpCode(HttpStatus.ACCEPTED)
  invite(@CurrentUser() ctx: TenantContext, @Body() dto: InviteUserDto) {
    return this.service.inviteUser(ctx, dto);
  }
}
