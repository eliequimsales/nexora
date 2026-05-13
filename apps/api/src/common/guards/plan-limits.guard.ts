import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanLimitsService } from '../billing/plan-limits.service';
import type { TenantContext } from '../tenant/tenant-context';

export type PlanLimitResource = 'leads' | 'aiExecutions';
export const PLAN_LIMIT_KEY = 'planLimit';
export const PlanLimit = (resource: PlanLimitResource) => SetMetadata(PLAN_LIMIT_KEY, resource);

@Injectable()
export class PlanLimitsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly planLimitsService: PlanLimitsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.getAllAndOverride<PlanLimitResource>(PLAN_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!resource) return true;

    const request = context.switchToHttp().getRequest();
    const ctx = request.user as TenantContext;
    if (!ctx?.orgId) return true;

    if (resource === 'leads') {
      await this.planLimitsService.assertLeadAllowed(ctx.orgId);
    } else if (resource === 'aiExecutions') {
      await this.planLimitsService.assertAiExecAllowed(ctx.orgId);
    }

    return true;
  }
}
