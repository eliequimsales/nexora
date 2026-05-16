import {
  ConflictException,
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { TokenService } from './token.service';
import { getNicheConfig } from '@nexora/shared';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { AuthResponseDto, AuthUserDto, AuthOrgDto } from './dto/auth-response.dto';
import type { Organization, User } from '@prisma/client';

// Constant-time guard: prevents timing attacks on missing users
const DUMMY_HASH =
  '$2a$12$KIX8s0twuGgFI.4dpznZ9uXTR8k3aefgNaU9AcIPVxm2LYPAtqcUu';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto & { refreshToken: string }> {
    let nicheConfig;
    try {
      nicheConfig = getNicheConfig(dto.niche);
    } catch {
      throw new BadRequestException(`Unsupported niche: ${dto.niche}`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const formToken = randomBytes(32).toString('hex');
    const slug = await this.generateUniqueSlug(dto.orgName);

    const { org, user } = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.orgName,
          slug,
          niche: dto.niche,
          formToken,
          aiPrompts: nicheConfig.aiPrompts as object,
        },
      });

      await tx.pipelineStage.createMany({
        data: nicheConfig.pipelineStages.map((s) => ({
          orgId: org.id,
          name: s.name,
          position: s.position,
          color: s.color,
          stageType: s.stageType,
          isDefault: s.isDefault,
        })),
      });

      const existing = await tx.user.findUnique({
        where: { orgId_email: { orgId: org.id, email: dto.email } },
      });
      if (existing) throw new ConflictException('Email already registered in this organization');

      const user = await tx.user.create({
        data: {
          orgId: org.id,
          email: dto.email,
          name: dto.name,
          passwordHash,
          role: 'admin',
        },
      });

      // Create trial subscription automatically — 7 days free
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);
      await tx.subscription.create({
        data: {
          orgId: org.id,
          stripeCustomerId: '', // Will be updated when user upgrades
          plan: 'starter', // Default plan for trial
          status: 'trialing',
          currentPeriodEnd: trialEnd,
          limits: {
            leadsPerMonth: 100, // Starter plan limits
            aiExecPerMonth: 50,
            maxUsers: 2,
          },
        },
      });

      return { org, user };
    });

    const tokens = await this.tokenService.generateTokens(
      user.id,
      org.id,
      user.role as 'admin' | 'member',
    );

    return {
      access_token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.mapUser(user),
      organization: this.mapOrg(org),
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto & { refreshToken: string }> {
    const org = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
      select: { id: true, status: true },
    });

    const user = org
      ? await this.prisma.user.findUnique({
          where: { orgId_email: { orgId: org.id, email: dto.email } },
          include: { organization: true },
        })
      : null;

    const hash = user?.passwordHash ?? DUMMY_HASH;
    const valid = await bcrypt.compare(dto.password, hash);

    if (!org || org.status !== 'active' || !user || !valid || user.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.tokenService.generateTokens(
      user.id,
      user.orgId,
      user.role as 'admin' | 'member',
    );

    return {
      access_token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.mapUser(user),
      organization: this.mapOrg(user.organization),
    };
  }

  async refresh(
    cookieValue: string,
  ): Promise<{ access_token: string; refreshToken: string }> {
    const separatorIndex = cookieValue.indexOf(':');
    if (separatorIndex === -1) throw new UnauthorizedException();

    const userId = cookieValue.substring(0, separatorIndex);
    const tokenId = cookieValue.substring(separatorIndex + 1);

    const valid = await this.tokenService.validateRefreshToken(userId, tokenId);
    if (!valid) throw new UnauthorizedException();

    // Rotate: revoke current before issuing new
    await this.tokenService.revokeRefreshToken(userId, tokenId);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'active') throw new UnauthorizedException();

    const org = await this.prisma.organization.findUnique({ where: { id: user.orgId } });
    if (!org || org.status !== 'active') throw new UnauthorizedException();

    const tokens = await this.tokenService.generateTokens(
      user.id,
      user.orgId,
      user.role as 'admin' | 'member',
    );

    return { access_token: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async logout(userId: string, tokenId: string): Promise<void> {
    await this.tokenService.revokeRefreshToken(userId, tokenId);
  }

  async me(
    userId: string,
    orgId: string,
  ): Promise<{ user: AuthUserDto; organization: AuthOrgDto }> {
    const [user, org] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.organization.findUnique({ where: { id: orgId } }),
    ]);

    if (!user || !org) throw new UnauthorizedException();

    return { user: this.mapUser(user), organization: this.mapOrg(org) };
  }

  private async generateUniqueSlug(orgName: string): Promise<string> {
    const base = orgName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 80);

    let slug = base;
    for (let i = 0; i < 5; i++) {
      const existing = await this.prisma.organization.findUnique({ where: { slug } });
      if (!existing) return slug;
      slug = `${base}-${randomBytes(3).toString('hex')}`;
    }
    return `${base}-${randomBytes(6).toString('hex')}`;
  }

  private mapUser(user: User): AuthUserDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }

  private mapOrg(org: Organization): AuthOrgDto {
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      niche: org.niche,
      status: org.status,
      formToken: org.formToken,
      settings: org.settings as Record<string, unknown>,
      createdAt: org.createdAt,
    };
  }
}
