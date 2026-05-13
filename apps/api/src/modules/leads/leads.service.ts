import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { parsePagination, buildPaginatedResult } from '../../common/helpers/pagination.helper';
import { assertSameTenant } from '../../common/tenant/assert-same-tenant';
import type { TenantContext } from '../../common/tenant/tenant-context';
import type { CreateLeadDto } from './dto/create-lead.dto';
import type { UpdateLeadDto } from './dto/update-lead.dto';
import type { ListLeadsDto } from './dto/list-leads.dto';
import { mapLead } from './dto/lead-response.dto';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateLeadDto, ctx: TenantContext) {
    // If pipelineStageId not provided, default to first stage of the org's pipeline
    // This ensures new leads appear in the Pipeline view immediately
    let pipelineStageId = dto.pipelineStageId ?? null;
    if (!pipelineStageId) {
      const firstStage = await this.prisma.pipelineStage.findFirst({
        where: { orgId: ctx.orgId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      pipelineStageId = firstStage?.id ?? null;
    }

    const lead = await this.prisma.lead.create({
      data: {
        orgId: ctx.orgId,
        name: dto.name,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        source: dto.source ?? 'manual',
        status: 'new',
        pipelineStageId,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        orgId: ctx.orgId,
        leadId: lead.id,
        userId: ctx.userId,
        type: 'lead_created',
        content: `Lead ${lead.name} criado`,
      },
    });

    this.eventEmitter.emit('lead.created', {
      orgId: ctx.orgId,
      leadId: lead.id,
      leadName: lead.name,
      triggeredBy: ctx.userId,
      payload: { source: lead.source, pipelineStageId: lead.pipelineStageId },
    });

    return mapLead(lead);
  }

  async findAll(params: ListLeadsDto, ctx: TenantContext) {
    const { skip, take, page, limit } = parsePagination(params);
    const { orgId } = ctx;

    const where: any = { orgId, archivedAt: null };

    if (params.status) where.status = params.status;
    if (params.classification) where.aiClassification = params.classification;
    if (params.assignedTo) where.assignedTo = params.assignedTo;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.lead.count({ where }),
    ]);

    return buildPaginatedResult(data.map(mapLead), total, page, limit);
  }

  async findOne(id: string, ctx: TenantContext) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    assertSameTenant(lead.orgId, ctx.orgId);
    return mapLead(lead);
  }

  async update(id: string, dto: UpdateLeadDto, ctx: TenantContext) {
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead não encontrado');
    assertSameTenant(existing.orgId, ctx.orgId);

    if (dto.pipelineStageId) {
      const stage = await this.prisma.pipelineStage.findUnique({
        where: { id: dto.pipelineStageId },
        select: { orgId: true },
      });
      if (!stage || stage.orgId !== ctx.orgId) throw new BadRequestException('Stage inválido');
    }

    if (dto.assignedTo) {
      const member = await this.prisma.user.findUnique({
        where: { id: dto.assignedTo },
        select: { orgId: true },
      });
      if (!member || member.orgId !== ctx.orgId) throw new BadRequestException('Usuário inválido');
    }

    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.pipelineStageId !== undefined && { pipelineStageId: dto.pipelineStageId }),
        ...(dto.assignedTo !== undefined && { assignedTo: dto.assignedTo }),
      },
    });

    if (dto.status && dto.status !== existing.status) {
      await this.prisma.activityLog.create({
        data: {
          orgId: ctx.orgId,
          leadId: lead.id,
          userId: ctx.userId,
          type: 'stage_changed',
          content: `Status alterado de ${existing.status} para ${dto.status}`,
        },
      });

      this.eventEmitter.emit('lead.status_changed', {
        orgId: ctx.orgId,
        leadId: lead.id,
        leadName: lead.name,
        triggeredBy: ctx.userId,
        fromStatus: existing.status,
        toStatus: dto.status,
        payload: {},
      });
    }

    if (dto.pipelineStageId && dto.pipelineStageId !== existing.pipelineStageId) {
      this.eventEmitter.emit('lead.stage_changed', {
        orgId: ctx.orgId,
        leadId: lead.id,
        leadName: lead.name,
        triggeredBy: ctx.userId,
        fromStageId: existing.pipelineStageId,
        toStageId: dto.pipelineStageId,
        payload: {},
      });
    }

    return mapLead(lead);
  }

  async archive(id: string, ctx: TenantContext) {
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead não encontrado');
    assertSameTenant(existing.orgId, ctx.orgId);

    const lead = await this.prisma.lead.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    await this.prisma.activityLog.create({
      data: {
        orgId: ctx.orgId,
        leadId: lead.id,
        userId: ctx.userId,
        type: 'lead_archived',
        content: `Lead ${lead.name} arquivado`,
      },
    });

    return mapLead(lead);
  }
}
