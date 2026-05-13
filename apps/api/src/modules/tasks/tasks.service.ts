import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { assertSameTenant } from '../../common/tenant/assert-same-tenant';
import { parsePagination, buildPaginatedResult } from '../../common/helpers/pagination.helper';
import { mapTask } from './dto/task-response.dto';
import type { TenantContext } from '../../common/tenant/tenant-context';
import type { CreateTaskDto } from './dto/create-task.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateTaskDto, ctx: TenantContext) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: dto.leadId },
      select: { id: true, orgId: true, name: true },
    });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    assertSameTenant(lead.orgId, ctx.orgId);

    if (dto.assignedTo) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assignedTo },
        select: { id: true, orgId: true, status: true },
      });
      if (!assignee || assignee.orgId !== ctx.orgId) {
        throw new BadRequestException('Usuário assignado não encontrado nesta organização');
      }
    }

    const creator = await this.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true },
    });

    const task = await this.prisma.task.create({
      data: {
        orgId: ctx.orgId,
        leadId: dto.leadId,
        createdBy: ctx.userId,
        assignedTo: dto.assignedTo ?? null,
        title: dto.title,
        status: 'pending',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        orgId: ctx.orgId,
        leadId: dto.leadId,
        userId: ctx.userId,
        type: 'task_created',
        content: `Tarefa "${task.title}" criada`,
        metadata: { taskId: task.id },
      },
    });

    this.eventEmitter.emit('task.created', {
      orgId: ctx.orgId,
      taskId: task.id,
      leadId: task.leadId,
      createdBy: task.createdBy,
      assignedTo: task.assignedTo,
      status: task.status,
    });

    let assignedUserName: string | null = null;
    if (dto.assignedTo) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assignedTo },
        select: { name: true },
      });
      assignedUserName = assignee?.name ?? null;
    }

    return mapTask(task, {
      leadName: lead.name,
      createdByName: creator?.name ?? null,
      assignedUserName,
    });
  }

  async findAll(
    ctx: TenantContext,
    filters: { status?: string; assignedTo?: string; leadId?: string; page?: number; limit?: number },
  ) {
    const { skip, take, page, limit } = parsePagination(filters);

    const where = {
      orgId: ctx.orgId,
      ...(filters.status && { status: filters.status }),
      ...(filters.assignedTo && { assignedTo: filters.assignedTo }),
      ...(filters.leadId && { leadId: filters.leadId }),
    };

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take,
        orderBy: [
          { status: 'asc' },
          { dueDate: 'asc' },
          { createdAt: 'desc' },
        ],
        include: {
          lead: { select: { name: true } },
          creator: { select: { name: true } },
          assignedUser: { select: { name: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    const mapped = tasks.map((t: any) =>
      mapTask(t, {
        leadName: t.lead.name,
        createdByName: t.creator?.name ?? null,
        assignedUserName: t.assignedUser?.name ?? null,
      }),
    );

    return buildPaginatedResult(mapped, total, page, limit);
  }

  async findOne(id: string, ctx: TenantContext) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        lead: { select: { name: true } },
        creator: { select: { name: true } },
        assignedUser: { select: { name: true } },
      },
    });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    assertSameTenant((task as any).orgId, ctx.orgId);

    return mapTask(task, {
      leadName: (task as any).lead.name,
      createdByName: (task as any).creator?.name ?? null,
      assignedUserName: (task as any).assignedUser?.name ?? null,
    });
  }

  async update(id: string, dto: UpdateTaskDto, ctx: TenantContext) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tarefa não encontrada');
    assertSameTenant((existing as any).orgId, ctx.orgId);

    if (dto.assignedTo != null) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assignedTo },
        select: { id: true, orgId: true },
      });
      if (!assignee || assignee.orgId !== ctx.orgId) {
        throw new BadRequestException('Usuário assignado não encontrado nesta organização');
      }
    }

    const statusChangingToDone =
      dto.status === 'done' && (existing as any).status !== 'done';
    const statusChangingToPending =
      dto.status === 'pending' && (existing as any).status === 'done';

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
        ...(dto.assignedTo !== undefined && { assignedTo: dto.assignedTo }),
        ...(statusChangingToDone && { completedAt: new Date() }),
        ...(statusChangingToPending && { completedAt: null }),
      },
      include: {
        lead: { select: { name: true } },
        creator: { select: { name: true } },
        assignedUser: { select: { name: true } },
      },
    });

    if (statusChangingToDone) {
      await this.prisma.activityLog.create({
        data: {
          orgId: ctx.orgId,
          leadId: (existing as any).leadId,
          userId: ctx.userId,
          type: 'task_done',
          content: `Tarefa "${(existing as any).title}" concluída`,
          metadata: { taskId: id },
        },
      });
    }

    return mapTask(updated, {
      leadName: (updated as any).lead.name,
      createdByName: (updated as any).creator?.name ?? null,
      assignedUserName: (updated as any).assignedUser?.name ?? null,
    });
  }

  async remove(id: string, ctx: TenantContext) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tarefa não encontrada');
    assertSameTenant((existing as any).orgId, ctx.orgId);
    await this.prisma.task.delete({ where: { id } });
  }
}
