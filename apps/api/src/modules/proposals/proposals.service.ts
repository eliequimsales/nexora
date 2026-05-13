import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { assertSameTenant } from '../../common/tenant/assert-same-tenant';
import { parsePagination, buildPaginatedResult } from '../../common/helpers/pagination.helper';
import { mapProposal, mapPublicProposal } from './dto/proposal-response.dto';
import type { TenantContext } from '../../common/tenant/tenant-context';
import type { CreateProposalDto, CreateProposalItemDto } from './dto/create-proposal.dto';
import type { UpdateProposalDto } from './dto/update-proposal.dto';

const INCLUDE_FULL = {
  lead: { select: { name: true } },
  items: true,
  _count: { select: { views: true } },
};

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateProposalDto, ctx: TenantContext) {
    const lead = await this.prisma.lead.findUnique({ where: { id: dto.leadId } });
    if (!lead || lead.orgId !== ctx.orgId) throw new NotFoundException('Lead não encontrado');

    const totalAmount = this.calcTotal(dto.items);

    const proposal = await this.prisma.proposal.create({
      data: {
        orgId: ctx.orgId,
        leadId: dto.leadId,
        createdBy: ctx.userId,
        title: dto.title,
        note: dto.note ?? null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        totalAmount,
        items: {
          create: dto.items.map((item, i) => ({
            orgId: ctx.orgId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
            position: i,
          })),
        },
      },
      include: INCLUDE_FULL,
    });

    return mapProposal(proposal);
  }

  async findAll(ctx: TenantContext, page = 1, limit = 20, status?: string, leadId?: string) {
    const { skip, take, page: p, limit: l } = parsePagination({ page, limit });

    const where: any = { orgId: ctx.orgId, archivedAt: null };
    if (status) where.status = status;
    if (leadId) where.leadId = leadId;

    const [data, total] = await Promise.all([
      this.prisma.proposal.findMany({
        where,
        include: INCLUDE_FULL,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.proposal.count({ where }),
    ]);

    return buildPaginatedResult(data.map(mapProposal), total, p, l);
  }

  async findOne(id: string, orgId: string) {
    const proposal = await this.prisma.proposal.findUnique({ where: { id }, include: INCLUDE_FULL });
    if (!proposal) throw new NotFoundException('Proposta não encontrada');
    assertSameTenant(proposal.orgId, orgId);
    return mapProposal(proposal);
  }

  async update(id: string, dto: UpdateProposalDto, ctx: TenantContext) {
    const proposal = await this.prisma.proposal.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException('Proposta não encontrada');
    assertSameTenant(proposal.orgId, ctx.orgId);

    if (proposal.status !== 'draft') {
      throw new BadRequestException('Apenas propostas em rascunho podem ser editadas');
    }

    const totalAmount = dto.items ? this.calcTotal(dto.items) : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.proposalItem.deleteMany({ where: { proposalId: id } });
      }

      return tx.proposal.update({
        where: { id },
        data: {
          ...(dto.title && { title: dto.title }),
          ...(dto.note !== undefined && { note: dto.note }),
          ...(dto.validUntil !== undefined && {
            validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          }),
          ...(totalAmount !== undefined && { totalAmount }),
          ...(dto.items && {
            items: {
              create: dto.items.map((item, i) => ({
                orgId: ctx.orgId,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.quantity * item.unitPrice,
                position: i,
              })),
            },
          }),
        },
        include: INCLUDE_FULL,
      });
    });

    return mapProposal(updated);
  }

  async archive(id: string, orgId: string) {
    const proposal = await this.prisma.proposal.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException('Proposta não encontrada');
    assertSameTenant(proposal.orgId, orgId);

    if (proposal.status !== 'draft') {
      throw new BadRequestException('Apenas rascunhos podem ser arquivados');
    }

    await this.prisma.proposal.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  async send(id: string, orgId: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: { lead: { select: { email: true, phone: true, name: true } } },
    });
    if (!proposal) throw new NotFoundException('Proposta não encontrada');
    assertSameTenant(proposal.orgId, orgId);

    if (proposal.status !== 'draft') {
      throw new BadRequestException('Proposta já foi enviada');
    }

    const token = randomUUID();
    const updated = await this.prisma.proposal.update({
      where: { id },
      data: { status: 'sent', token, sentAt: new Date() },
      include: INCLUDE_FULL,
    });

    // NotificationsService handles delivery via @OnEvent('proposal.sent')
    this.eventEmitter.emit('proposal.sent', { orgId, proposalId: id, leadId: proposal.leadId });

    return mapProposal(updated);
  }

  async duplicate(id: string, ctx: TenantContext) {
    const proposal = await this.prisma.proposal.findUnique({ where: { id }, include: { items: true } });
    if (!proposal) throw new NotFoundException('Proposta não encontrada');
    assertSameTenant(proposal.orgId, ctx.orgId);

    const copy = await this.prisma.proposal.create({
      data: {
        orgId: ctx.orgId,
        leadId: proposal.leadId,
        createdBy: ctx.userId,
        title: `${proposal.title} (cópia)`,
        note: proposal.note,
        validUntil: proposal.validUntil,
        totalAmount: proposal.totalAmount,
        items: {
          create: proposal.items.map((item) => ({
            orgId: ctx.orgId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            position: item.position,
          })),
        },
      },
      include: INCLUDE_FULL,
    });

    return mapProposal(copy);
  }

  // ── Public (no auth) ────────────────────────────────────────────────────────

  async findByToken(token: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { token },
      include: {
        organization: { select: { name: true } },
        lead: { select: { name: true } },
        items: true,
      },
    });
    if (!proposal) throw new NotFoundException('Proposta não encontrada');
    return mapPublicProposal(proposal);
  }

  async recordView(token: string, ip: string | null, userAgent: string | null) {
    const proposal = await this.prisma.proposal.findUnique({ where: { token } });
    if (!proposal || !['sent', 'viewed'].includes(proposal.status)) return;

    await this.prisma.$transaction([
      this.prisma.proposalView.create({
        data: { proposalId: proposal.id, orgId: proposal.orgId, ip, userAgent },
      }),
      ...(proposal.status === 'sent'
        ? [this.prisma.proposal.update({
            where: { id: proposal.id },
            data: { status: 'viewed', viewedAt: new Date() },
          })]
        : []),
    ]);
  }

  async respond(token: string, action: 'accept' | 'reject', reason?: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { token },
      include: { lead: { select: { id: true, orgId: true } } },
    });
    if (!proposal) throw new NotFoundException('Proposta não encontrada');
    if (!['sent', 'viewed'].includes(proposal.status)) {
      throw new BadRequestException('Esta proposta não pode mais ser respondida');
    }

    if (proposal.validUntil && proposal.validUntil < new Date()) {
      await this.prisma.proposal.update({ where: { id: proposal.id }, data: { status: 'expired' } });
      throw new BadRequestException('Esta proposta expirou');
    }

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';

    await this.prisma.$transaction([
      this.prisma.proposal.update({
        where: { id: proposal.id },
        data: { status: newStatus, respondedAt: new Date() },
      }),
      ...(action === 'accept'
        ? [this.prisma.lead.update({
            where: { id: proposal.leadId },
            data: { status: 'closed_won' },
          })]
        : []),
    ]);

    const eventName = action === 'accept' ? 'proposal.accepted' : 'proposal.rejected';
    this.eventEmitter.emit(eventName, {
      orgId: proposal.orgId,
      proposalId: proposal.id,
      leadId: proposal.leadId,
      reason: reason ?? null,
    });
  }

  private calcTotal(items: CreateProposalItemDto[]): number {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }
}
