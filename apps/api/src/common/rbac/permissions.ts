import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS, type Permission, type Role } from '@nexora/shared';

export { PERMISSIONS };
export type { Permission, Role };

export const REQUIRE_PERMISSION_KEY = 'permission';

/**
 * Declares the permission required to access a route.
 * The RolesGuard reads this to derive the required role from PERMISSIONS.
 *
 * Usage: @RequirePermission('org:update')
 */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
