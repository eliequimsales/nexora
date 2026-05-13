import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { assertSameTenant } from '../../common/tenant/assert-same-tenant';
import { mapStageWithLeads } from './dto/stage-response.dto';
import type { TenantContext } from '../../common/tenant/tenant-context';
import type { UpdateStageDto } from './dto/update-stage.dto';

@Injectable()
export class PipelineService {
  constructor(private readonly prisma: PrismaService) {}

  async getBoard(ctx: TenantContext) {
    const stages = await this.prisma.pipelineStage.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { position: 'asc' },
      include: {
        leads: {
          where: { archivedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            aiClassification: true,
            aiScore: true,
            assignedTo: true,
            createdAt: true,
          },
        },
      },
    });

    return { stages: stages.map(mapStageWithLeads) };
  }

  async updateStage(id: string, dto: UpdateStageDto, ctx: TenantContext) {
    const stage = await this.prisma.pipelineStage.findUnique({ where: { id } });
    if (!stage) throw new NotFoundException('Estágio não encontrado');
    assertSameTenant(stage.orgId, ctx.orgId);

    const updated = await this.prisma.pipelineStage.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
    });

    return updated;
  }
}
