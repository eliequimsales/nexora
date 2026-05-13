export type Role = 'admin' | 'member';

export const PERMISSIONS = {
  'org:read': 'member',
  'org:update': 'admin',
  'users:list': 'member',
  'users:read': 'member',
  'users:update': 'admin',
  'users:invite': 'admin',
  'leads:read': 'member',
  'leads:create': 'member',
  'leads:update': 'member',
  'leads:delete': 'admin',
  'pipeline:read': 'member',
  'pipeline:manage': 'admin',
  'workflows:read': 'member',
  'workflows:manage': 'admin',
  'analytics:read': 'member',
  'activity-logs:read': 'member',
  'audit-logs:read': 'admin',
  'integrations:read': 'admin',
  'integrations:manage': 'admin',
  'copilot:read': 'member',
  'proposals:read': 'member',
  'proposals:manage': 'member',
  'settings:read': 'member',
  'settings:update': 'admin',
  'tasks:read': 'member',
  'tasks:manage': 'member',
  'assistente-financeiro:generate-message': 'member',
  'assistente-financeiro:read-metrics': 'member',
  'assistente-financeiro:record-feedback': 'admin',
} as const satisfies Record<string, Role>;

export type Permission = keyof typeof PERMISSIONS;

export const ROLE_HIERARCHY: Record<Role, number> = { admin: 2, member: 1 };

export function hasPermission(userRole: string | undefined, permission: Permission): boolean {
  if (!userRole) return false;
  const required = PERMISSIONS[permission];
  const userLevel = ROLE_HIERARCHY[userRole as Role] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[required] ?? 0;
  return userLevel >= requiredLevel;
}
