import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS, ROLE_HIERARCHY, type Role } from '@reshit/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { REQUIRE_PERMISSION_KEY } from '../rbac/permissions';
import type { TenantContext } from '../tenant/tenant-context';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRole = this.resolveRequiredRole(context);

    // No role constraint declared → any authenticated user is allowed
    if (!requiredRole) return true;

    const { user } = context.switchToHttp().getRequest<{ user: TenantContext }>();
    if (!user) throw new ForbiddenException();

    const userLevel = ROLE_HIERARCHY[user.role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;

    if (userLevel < requiredLevel) throw new ForbiddenException();

    return true;
  }

  private resolveRequiredRole(context: ExecutionContext): Role | null {
    // @RequirePermission takes priority — derives role from permissions map
    const permission = this.reflector.getAllAndOverride<string>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (permission && permission in PERMISSIONS) {
      return PERMISSIONS[permission as keyof typeof PERMISSIONS];
    }

    // Fall back to @Roles() for backwards compatibility
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles?.length) return roles[0];

    return null;
  }
}
