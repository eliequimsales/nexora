import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { parsePagination, buildPaginatedResult } from '../../common/helpers/pagination.helper';

const INCLUDE_ACTOR = {
  lead: { select: { id: true, name: true } },
  user: { select: { id: true, name: true, avatarUrl: true } },
};

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async findByLead(orgId: string, leadId: string, page = 1, limit = 20) {
    const { skip, take } = parsePagination({ page, limit });

    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where: { orgId, leadId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: INCLUDE_ACTOR,
      }),
      this.prisma.activityLog.count({ where: { orgId, leadId } }),
    ]);

    const items = data.map((log) => ({
      id: log.id,
      type: log.type,
      content: log.content,
      metadata: log.metadata,
      leadId: log.lead.id,
      leadName: log.lead.name,
      userId: log.userId,
      userName: log.user?.name ?? null,
      userAvatarUrl: log.user?.avatarUrl ?? null,
      createdAt: log.createdAt,
    }));

    return buildPaginatedResult(items, total, page, limit);
  }

  async createNote(orgId: string, leadId: string, userId: string, content: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, select: { orgId: true } });
    if (!lead || lead.orgId !== orgId) {
      throw new Error('Lead not found');
    }

    return this.prisma.activityLog.create({
      data: { orgId, leadId, userId, type: 'manual_note', content },
    });
  }

  async findByOrg(orgId: string, page = 1, limit = 20) {
    const { skip, take } = parsePagination({ page, limit });

    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: INCLUDE_ACTOR,
      }),
      this.prisma.activityLog.count({ where: { orgId } }),
    ]);

    const items = data.map((log) => ({
      id: log.id,
      type: log.type,
      content: log.content,
      metadata: log.metadata,
      leadId: log.lead.id,
      leadName: log.lead.name,
      userId: log.userId,
      userName: log.user?.name ?? null,
      userAvatarUrl: log.user?.avatarUrl ?? null,
      createdAt: log.createdAt,
    }));

    return buildPaginatedResult(items, total, page, limit);
  }
}
