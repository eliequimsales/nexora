import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { parsePagination, buildPaginatedResult } from '../../common/helpers/pagination.helper';

export interface RecordAuditDto {
  orgId: string;
  actorId: string | null;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilters {
  action?: string;
  actorId?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  record(dto: RecordAuditDto): void {
    this.write(dto).catch((err) => this.logger.error('audit write failed', err));
  }

  private async write(dto: RecordAuditDto): Promise<void> {
    let actorEmail = 'system';
    if (dto.actorId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.actorId },
        select: { email: true },
      });
      actorEmail = user?.email ?? 'unknown';
    }

    await this.prisma.auditLog.create({
      data: {
        orgId: dto.orgId,
        actorId: dto.actorId ?? null,
        actorEmail,
        actorRole: dto.actorRole,
        action: dto.action,
        resourceType: dto.resourceType,
        resourceId: dto.resourceId ?? null,
        resourceName: dto.resourceName ?? null,
        metadata: (dto.metadata ?? {}) as object,
        ipAddress: dto.ipAddress ?? null,
        userAgent: dto.userAgent ?? null,
      },
    });
  }

  async findAll(orgId: string, filters: AuditLogFilters) {
    const { skip, take, page, limit } = parsePagination(filters);

    const where: Record<string, unknown> = { orgId };
    if (filters.action) where.action = filters.action;
    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from && { gte: new Date(filters.from) }),
        ...(filters.to && { lte: new Date(filters.to) }),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }
}
