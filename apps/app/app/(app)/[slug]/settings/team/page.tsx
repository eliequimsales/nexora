'use client';

import { useState } from 'react';
import { Users, UserPlus, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UsersList } from '@/components/modules/users/UsersList';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/hooks/auth/useAuth';
import { useToast } from '@/lib/providers/ToastProvider';
import { usersApi } from '@/lib/api/users.api';
import { USERS_QUERY_KEY } from '@/lib/hooks/users/useUsersQuery';

function InviteModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');

  const { mutate, isPending, data: result } = useMutation({
    mutationFn: () => usersApi.invite({ email: email.trim(), role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY() });
      toast({ variant: 'success', title: 'Usuário convidado com sucesso' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Erro ao convidar usuário';
      toast({ variant: 'error', title: msg });
    },
  });

  const invitedData = (result as any)?.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-surface shadow-xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-brand-border">
          <h2 className="text-sm font-semibold text-text-primary">Convidar membro</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        {invitedData?.tempPassword ? (
          <div className="p-5 space-y-4">
            <p className="text-sm text-text-secondary">
              Usuário criado. Compartilhe as credenciais abaixo com <strong>{email}</strong>:
            </p>
            <div className="rounded-lg border border-brand-border bg-brand-surface-2 p-3 space-y-2 text-xs font-mono text-text-secondary">
              <p>Email: <span className="text-text-primary">{email}</span></p>
              <p>Senha temporária: <span className="text-brand-amber select-all">{invitedData.tempPassword}</span></p>
            </div>
            <p className="text-xs text-text-muted">O usuário pode trocar a senha após o primeiro login.</p>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-brand-amber px-4 py-2 text-sm font-medium text-brand-bg hover:opacity-90"
            >
              Fechar
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-amber focus:border-brand-amber"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5">Papel</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
                className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand-amber focus:border-brand-amber"
              >
                <option value="member">Membro</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-brand-border px-4 py-2 text-sm text-text-secondary hover:bg-brand-surface-2"
              >
                Cancelar
              </button>
              <button
                onClick={() => mutate()}
                disabled={isPending || !email.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-amber px-4 py-2 text-sm font-medium text-brand-bg hover:opacity-90 disabled:opacity-40"
              >
                {isPending && <Spinner size="sm" />}
                Convidar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { hasRole } = useAuth();
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <Users size={18} className="text-text-secondary" />
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Equipe</h1>
            <p className="text-xs text-text-muted">Membros da organização</p>
          </div>
        </div>
        {hasRole('admin') && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-brand-surface transition-colors"
          >
            <UserPlus size={13} />
            Convidar
          </button>
        )}
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
        <h2 className="text-sm font-medium text-text-primary mb-4">Membros</h2>
        <UsersList />
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}
