import { usePermissions } from '@/lib/hooks/auth/usePermissions';
import type { Permission } from '@/lib/rbac/permissions';

interface CanDoProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renders children only if the current user has the required permission.
 *
 * <CanDo permission="org:update">
 *   <EditButton />
 * </CanDo>
 *
 * <CanDo permission="users:invite" fallback={<p>Apenas admins podem convidar</p>}>
 *   <InviteButton />
 * </CanDo>
 */
export function CanDo({ permission, children, fallback = null }: CanDoProps) {
  const { can } = usePermissions();
  return can(permission) ? <>{children}</> : <>{fallback}</>;
}
