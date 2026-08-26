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
import type { Organization, User } from '@nexora/api-prisma';

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
    const niche = dto.niche ?? 'barbearia';
    const userName = dto.name ?? dto.orgName;

    let nicheConfig;
    try {
      nicheConfig = getNicheConfig(niche);
    } catch {
      throw new BadRequestException(`Unsupported niche: ${niche}`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const formToken = randomBytes(32).toString('hex');
    const slug = await this.generateUniqueSlug(dto.orgName);

    const { org, user } = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.orgName,
          slug,
          niche,
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
          name: userName,
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
    // Quando slug não é informado, resolve automaticamente pelo email do usuário.
    // Para múltiplos workspaces no futuro, retornar lista e pedir seleção.
    let user: (User & { organization: Organization }) | null = null;

    if (dto.slug) {
      const org = await this.prisma.organization.findUnique({
        where: { slug: dto.slug },
        select: { id: true, status: true },
      });
      if (org?.status === 'active') {
        user = await this.prisma.user.findUnique({
          where: { orgId_email: { orgId: org.id, email: dto.email } },
          include: { organization: true },
        });
      }
    } else {
      // Sem slug: busca pelo email — assume 1 org por usuário (piloto)
      user = await this.prisma.user.findFirst({
        where: { email: dto.email },
        include: { organization: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    const hash = user?.passwordHash ?? DUMMY_HASH;
    const valid = await bcrypt.compare(dto.password, hash);
    const org = user?.organization;

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

  /** Cria ou loga um usuário via Google OAuth */
  async googleAuth(
    googleProfile: { googleId: string; email: string; name: string; picture?: string },
  ): Promise<AuthResponseDto & { refreshToken: string }> {
    const email = googleProfile.email.toLowerCase();

    // Estratégia de resolução de identidade (em ordem):
    // 1. Busca por googleId — se já vinculado, é o caminho mais confiável
    // 2. Busca por email + tem googleId — é a mesma conta, retorna direto
    // 3. Busca por email sem googleId — vincula o googleId nessa conta
    // 4. Nenhum dos acima → cria conta nova
    let user = await this.prisma.user.findUnique({
      where: { googleId: googleProfile.googleId },
      include: { organization: true },
    });

    if (!user) {
      // Procura por email; se houver várias (testes), pega a que já tem googleId
      const byEmail = await this.prisma.user.findMany({
        where: { email },
        include: { organization: true },
        orderBy: { createdAt: 'desc' },
      });

      user = byEmail.find((u) => u.googleId === googleProfile.googleId)
        ?? byEmail.find((u) => !u.googleId)
        ?? null;

      if (user && !user.googleId) {
        // Tenta vincular o googleId. Se falhar por race condition/unique
        // constraint, ignora e segue sem vincular (já estamos logando essa conta).
        try {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { googleId: googleProfile.googleId },
            include: { organization: true },
          });
        } catch {
          // Já existe outra row com esse googleId — segue sem vincular
        }
      }
    }

    if (!user) {
      // Primeiro acesso real via Google: cria conta nova
      const orgName = googleProfile.name;
      const niche = 'barbearia';
      const nicheConfig = getNicheConfig(niche);
      const formToken = randomBytes(32).toString('hex');
      const slug = await this.generateUniqueSlug(orgName);
      const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);

      const result = await this.prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: orgName, slug, niche, formToken, aiPrompts: nicheConfig.aiPrompts as object },
        });
        await tx.pipelineStage.createMany({
          data: nicheConfig.pipelineStages.map((s) => ({
            orgId: org.id, name: s.name, position: s.position,
            color: s.color, stageType: s.stageType, isDefault: s.isDefault,
          })),
        });
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 7);
        await tx.subscription.create({
          data: { orgId: org.id, stripeCustomerId: '', plan: 'starter', status: 'trialing', currentPeriodEnd: trialEnd, limits: { leadsPerMonth: 100 } },
        });
        const newUser = await tx.user.create({
          data: { orgId: org.id, email, name: googleProfile.name, passwordHash, role: 'admin', googleId: googleProfile.googleId },
          include: { organization: true },
        });
        return newUser;
      });
      user = result;
    }

    if (user.status !== 'active' || user.organization.status !== 'active') {
      throw new UnauthorizedException('Conta desativada');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const tokens = await this.tokenService.generateTokens(user.id, user.orgId, user.role as 'admin' | 'member');
    return { access_token: tokens.accessToken, refreshToken: tokens.refreshToken, user: this.mapUser(user), organization: this.mapOrg(user.organization) };
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
