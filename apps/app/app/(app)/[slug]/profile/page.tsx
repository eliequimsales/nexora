'use client';

import { UserCircle } from 'lucide-react';
import { ProfileForm } from '@/components/modules/users/ProfileForm';
import { Spinner } from '@/components/ui/Spinner';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users.api';

export default function ProfilePage() {
  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => usersApi.me().then((r) => r.data),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Spinner variant="amber" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="p-6">
        <p className="text-sm text-status-error">Erro ao carregar perfil.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg">
      <div className="flex items-center gap-2.5 mb-6">
        <UserCircle size={18} className="text-text-secondary" />
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Meu perfil</h1>
          <p className="text-xs text-text-muted">{user.email}</p>
        </div>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
        <ProfileForm user={user} />
      </div>
    </div>
  );
}
