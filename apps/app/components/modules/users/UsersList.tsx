'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserX, UserCheck } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { usersApi } from '@/lib/api/users.api';
import { useUsersQuery, USERS_QUERY_KEY } from '@/lib/hooks/users/useUsersQuery';
import { useAuth } from '@/lib/hooks/auth/useAuth';
import { useToast } from '@/lib/providers/ToastProvider';
import { formatRelativeTime } from '@/lib/utils';
import type { OrgUser } from '@/types';

function RoleSelector({ user, disabled }: { user: OrgUser; disabled: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { mutate, isPending } = useMutation({
    mutationFn: (role: 'admin' | 'member') => usersApi.update(user.id, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY() });
    },
    onError: () => {
      toast({ variant: 'error', title: 'Erro ao alterar papel' });
    },
  });

  if (disabled) {
    return (
      <Badge variant={user.role === 'admin' ? 'amber' : 'default'}>
        {user.role === 'admin' ? 'Admin' : 'Membro'}
      </Badge>
    );
  }

  return (
    <div className="relative flex items-center gap-1.5">
      {isPending && <Spinner size="sm" />}
      <select
        value={user.role}
        onChange={(e) => mutate(e.target.value as 'admin' | 'member')}
        disabled={isPending}
        className="text-xs rounded-md border border-brand-border bg-brand-surface-2 text-text-secondary px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-amber focus:border-brand-amber transition-colors disabled:opacity-50"
      >
        <option value="member">Membro</option>
        <option value="admin">Admin</option>
      </select>
    </div>
  );
}

function StatusToggle({ user, disabled }: { user: OrgUser; disabled: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isInactive = user.status === 'inactive';

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      usersApi.update(user.id, { status: isInactive ? 'active' : 'inactive' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY() });
      toast({
        variant: 'success',
        title: isInactive ? 'Usuário reativado' : 'Usuário desativado',
      });
    },
    onError: () => {
      toast({ variant: 'error', title: 'Erro ao alterar status' });
    },
  });

  if (disabled) return null;

  return (
    <button
      onClick={() => {
        if (!isInactive && !confirm(`Desativar ${user.name}? Ele perderá acesso imediatamente.`)) return;
        mutate();
      }}
      disabled={isPending}
      title={isInactive ? 'Reativar usuário' : 'Desativar usuário'}
      className="p-1 rounded text-text-muted hover:text-status-error transition-colors disabled:opacity-40"
    >
      {isPending ? <Spinner size="sm" /> : isInactive ? <UserCheck size={14} /> : <UserX size={14} />}
    </button>
  );
}

export function UsersList() {
  const { data, isLoading, isError } = useUsersQuery();
  const { user: currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner variant="amber" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-status-error py-4">
        Erro ao carregar membros. Tente recarregar a página.
      </p>
    );
  }

  const users = data?.data ?? [];

  return (
    <div className="divide-y divide-brand-border">
      {users.map((user) => {
        const isSelf = user.id === currentUser?.id;

        return (
          <div key={user.id} className="flex items-center gap-3 py-3">
            <Avatar name={user.name} src={user.avatarUrl ?? undefined} size="md" />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-text-primary truncate">
                  {user.name}
                  {isSelf && (
                    <span className="ml-1.5 text-xs text-text-muted">(você)</span>
                  )}
                </p>
                {user.status === 'inactive' && (
                  <Badge variant="default">Inativo</Badge>
                )}
              </div>
              <p className="text-xs text-text-muted truncate">{user.email}</p>
              <p className="text-2xs text-text-muted mt-0.5">
                Entrou em {new Date(user.createdAt).toLocaleDateString('pt-BR')}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {user.lastLoginAt && (
                <span className="text-xs text-text-muted hidden sm:block">
                  {formatRelativeTime(user.lastLoginAt)}
                </span>
              )}

              <RoleSelector user={user} disabled={!isAdmin || isSelf} />
              <StatusToggle user={user} disabled={!isAdmin || isSelf} />
            </div>
          </div>
        );
      })}

      {users.length === 0 && (
        <p className="text-sm text-text-muted py-6 text-center">
          Nenhum membro encontrado.
        </p>
      )}
    </div>
  );
}
