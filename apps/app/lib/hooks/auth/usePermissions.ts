'use client';

import { useAuthStore } from '@/lib/stores/auth.store';
import { hasPermission, type Permission } from '@/lib/rbac/permissions';

/**
 * Returns permission checks for the current user.
 *
 * can(permission)  — generic check for any declared permission
 * Semantic helpers — named booleans for the most common UI conditions
 */
export function usePermissions() {
  const role = useAuthStore((s) => s.user?.role);

  const can = (permission: Permission): boolean => hasPermission(role, permission);

  return {
    can,
    canEditOrg: can('org:update'),
    canManageTeam: can('users:update'),
    canInviteUsers: can('users:invite'),
    canDeleteLeads: can('leads:delete'),
    canManagePipeline: can('pipeline:manage'),
    canUpdateSettings: can('settings:update'),
  };
}
