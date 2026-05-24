import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { mapOrg } from './dto/org-response.dto';
import { getTemplate } from '@nexora/shared';
import type { UpdateOrgDto } from './dto/update-org.dto';
import type { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import type { OrgResponseDto } from './dto/org-response.dto';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findOwn(ctx: TenantContext): Promise<OrgResponseDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id: ctx.orgId },
    });
    if (!org) throw new NotFoundException();
    return mapOrg(org);
  }

  /**
   * Registra que a organização aceitou o termo LGPD vigente.
   *
   * O `lgpdTermVersion` é fixo no código — quando o texto mudar, bumpamos
   * essa constante e o front detecta que precisa pedir re-aceite (porque
   * `org.lgpdTermVersion !== CURRENT_LGPD_TERM_VERSION`).
   *
   * Idempotente: re-chamar atualiza o timestamp e o user que aceitou.
   */
  async acceptLgpdTerm(
    ctx: TenantContext,
  ): Promise<{ acceptedAt: Date; version: string }> {
    const CURRENT_LGPD_TERM_VERSION = '2026-05-18';

    const updated = await this.prisma.organization.update({
      where: { id: ctx.orgId },
      data: {
        lgpdAcceptedAt: new Date(),
        lgpdAcceptedBy: ctx.userId,
        lgpdTermVersion: CURRENT_LGPD_TERM_VERSION,
      },
      select: { lgpdAcceptedAt: true, lgpdTermVersion: true },
    });

    return {
      acceptedAt: updated.lgpdAcceptedAt!,
      version: updated.lgpdTermVersion!,
    };
  }

  async update(ctx: TenantContext, dto: UpdateOrgDto): Promise<OrgResponseDto> {
    const exists = await this.prisma.organization.findUnique({
      where: { id: ctx.orgId },
      select: { id: true, settings: true },
    });
    if (!exists) throw new NotFoundException();

    // Merge settings patch into existing settings — never blindly replace
    const currentSettings = (exists.settings ?? {}) as Record<string, unknown>;
    const mergedSettings = dto.settings
      ? { ...currentSettings, ...dto.settings }
      : currentSettings;

    const updated = await this.prisma.organization.update({
      where: { id: ctx.orgId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.aiPrompts !== undefined && { aiPrompts: dto.aiPrompts as object }),
        settings: mergedSettings as object,
      },
    });

    return mapOrg(updated);
  }

  async updateOnboarding(ctx: TenantContext, dto: UpdateOnboardingDto): Promise<OrgResponseDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id: ctx.orgId },
      select: { id: true, settings: true },
    });
    if (!org) throw new NotFoundException();

    const currentSettings = (org.settings ?? {}) as Record<string, unknown>;
    const currentOnboarding = (currentSettings.onboarding ?? {}) as Record<string, unknown>;

    const onboardingPatch: Record<string, unknown> = { ...currentOnboarding };
    if (dto.wizardStep !== undefined) onboardingPatch.wizardStep = dto.wizardStep;
    if (dto.dismissed !== undefined) onboardingPatch.dismissed = dto.dismissed;
    if (dto.wizardCompleted !== undefined) {
      onboardingPatch.wizardCompleted = dto.wizardCompleted;
      if (dto.wizardCompleted) {
        onboardingPatch.wizardCompletedAt = new Date().toISOString();
      }
    }

    const updated = await this.prisma.organization.update({
      where: { id: ctx.orgId },
      data: {
        settings: { ...currentSettings, onboarding: onboardingPatch } as object,
      },
    });

    return mapOrg(updated);
  }

  async applyTemplate(ctx: TenantContext, templateId: string): Promise<OrgResponseDto> {
    const template = getTemplate(templateId);
    if (!template) throw new BadRequestException(`Template "${templateId}" não encontrado`);

    const org = await this.prisma.organization.findUnique({
      where: { id: ctx.orgId },
      include: { _count: { select: { leads: true } } },
    });
    if (!org) throw new NotFoundException();

    const hasLeads = (org._count?.leads ?? 0) > 0;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (!hasLeads) {
        await tx.pipelineStage.deleteMany({ where: { orgId: ctx.orgId } });
      }

      // Determine next position if org has leads (append mode)
      let positionOffset = 0;
      if (hasLeads) {
        const lastStage = await tx.pipelineStage.findFirst({
          where: { orgId: ctx.orgId },
          orderBy: { position: 'desc' },
          select: { position: true },
        });
        positionOffset = lastStage?.position ?? 0;
      }

      await tx.pipelineStage.createMany({
        data: template.pipelineStages.map((s) => ({
          orgId: ctx.orgId,
          name: s.name,
          position: s.position + positionOffset,
          color: s.color,
          stageType: s.stageType,
          isDefault: hasLeads ? false : s.isDefault,
        })),
        skipDuplicates: true,
      });

      await tx.workflow.createMany({
        data: template.workflows.map((w) => ({
          orgId: ctx.orgId,
          name: w.name,
          description: w.description,
          isActive: true,
          triggerType: w.triggerType,
          triggerConditions: w.triggerConditions as object,
          actionType: w.actionType,
          actionConfig: w.actionConfig as object,
        })),
      });

      const currentSettings = (org.settings ?? {}) as Record<string, unknown>;
      return tx.organization.update({
        where: { id: ctx.orgId },
        data: {
          niche: template.niche,
          aiPrompts: template.aiPrompts as object,
          settings: {
            ...currentSettings,
            appliedTemplate: {
              id: template.id,
              appliedAt: new Date().toISOString(),
              version: template.version,
            },
          },
        },
      });
    });

    this.auditLog.record({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      actorRole: ctx.role,
      action: 'organization.template_applied',
      resourceType: 'organization',
      resourceId: ctx.orgId,
      metadata: {
        templateId,
        templateVersion: template.version,
        hasLeads,
        mode: hasLeads ? 'append' : 'replace',
      },
    });

    this.eventEmitter.emit('organization.template_applied', {
      orgId: ctx.orgId,
      templateId,
      version: template.version,
    });

    return mapOrg(updated);
  }
}
