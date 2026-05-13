import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { assertSameTenant } from '../../common/tenant/assert-same-tenant';
import { parsePagination, buildPaginatedResult } from '../../common/helpers/pagination.helper';
import { mapUser } from './dto/user-response.dto';
import type { UserResponseDto } from './dto/user-response.dto';
import type { ListUsersDto } from './dto/list-users.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { InviteUserDto } from './dto/invite-user.dto';
import type { TenantContext } from '../../common/tenant/tenant-context';
import type { PaginatedResult } from '../../common/helpers/pagination.helper';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ── Own profile ────────────────────────────────────────────────────────────

  async getProfile(ctx: TenantContext): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: ctx.userId } });
    if (!user) throw new NotFoundException();
    return mapUser(user);
  }

  async updateProfile(ctx: TenantContext, dto: UpdateProfileDto): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: ctx.userId } });
    if (!user) throw new NotFoundException();

    if (!dto.name && !dto.avatarUrl) {
      throw new BadRequestException('Nothing to update');
    }

    const updated = await this.prisma.user.update({
      where: { id: ctx.userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
    });

    return mapUser(updated);
  }

  // ── Team management ────────────────────────────────────────────────────────

  async findAll(ctx: TenantContext, query: ListUsersDto): Promise<PaginatedResult<UserResponseDto>> {
    const { skip, take, page, limit } = parsePagination(query);

    const where = {
      orgId: ctx.orgId,
      ...(query.status && { status: query.status }),
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'asc' } }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResult(users.map(mapUser), total, page, limit);
  }

  async findOne(ctx: TenantContext, userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    assertSameTenant(user.orgId, ctx.orgId);
    return mapUser(user);
  }

  async update(ctx: TenantContext, userId: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new NotFoundException();
    assertSameTenant(user.orgId, ctx.orgId);

    if (userId === ctx.userId) {
      if (dto.role && dto.role !== user.role) {
        throw new ForbiddenException('Cannot change your own role');
      }
      if (dto.status === 'inactive') {
        throw new ForbiddenException('Cannot deactivate your own account');
      }
    }

    if (!dto.role && !dto.status) {
      throw new BadRequestException('Nothing to update');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });

    if (dto.role && dto.role !== user.role) {
      this.auditLog.record({
        orgId: ctx.orgId,
        actorId: ctx.userId,
        actorRole: ctx.role,
        action: 'user.role_changed',
        resourceType: 'user',
        resourceId: userId,
        resourceName: user.name,
        metadata: { from: user.role, to: dto.role },
      });
    }

    if (dto.status === 'inactive' && user.status !== 'inactive') {
      this.auditLog.record({
        orgId: ctx.orgId,
        actorId: ctx.userId,
        actorRole: ctx.role,
        action: 'user.deactivated',
        resourceType: 'user',
        resourceId: userId,
        resourceName: user.name,
      });
    }

    return mapUser(updated);
  }

  // ── Invite ────────────────────────────────────────────────────────────────

  async inviteUser(ctx: TenantContext, dto: InviteUserDto): Promise<{ tempPassword: string }> {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email, orgId: ctx.orgId },
    });

    if (existing) {
      throw new ConflictException('Já existe um usuário com este email nesta organização');
    }

    const tempPassword = randomBytes(6).toString('hex'); // 12-char hex
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const namePart = dto.email.split('@')[0] ?? 'Usuário';
    const name = namePart.charAt(0).toUpperCase() + namePart.slice(1);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name,
        passwordHash,
        role: dto.role,
        status: 'active',
        orgId: ctx.orgId,
      },
    });

    this.auditLog.record({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      actorRole: ctx.role,
      action: 'user.invited',
      resourceType: 'user',
      resourceId: user.id,
      resourceName: user.name,
      metadata: { email: dto.email, role: dto.role },
    });

    return { tempPassword };
  }
}
