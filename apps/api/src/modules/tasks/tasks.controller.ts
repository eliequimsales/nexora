import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/rbac/permissions';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @RequirePermission('tasks:manage')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTaskDto, @CurrentUser() ctx: TenantContext) {
    return this.tasksService.create(dto, ctx);
  }

  @Get()
  @RequirePermission('tasks:read')
  findAll(
    @CurrentUser() ctx: TenantContext,
    @Query('status') status?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('leadId') leadId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tasksService.findAll(ctx, {
      status,
      assignedTo,
      leadId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @RequirePermission('tasks:read')
  findOne(@Param('id') id: string, @CurrentUser() ctx: TenantContext) {
    return this.tasksService.findOne(id, ctx);
  }

  @Patch(':id')
  @RequirePermission('tasks:manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() ctx: TenantContext,
  ) {
    return this.tasksService.update(id, dto, ctx);
  }

  @Delete(':id')
  @RequirePermission('tasks:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() ctx: TenantContext) {
    return this.tasksService.remove(id, ctx);
  }
}
