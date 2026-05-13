'use client';

import { useMutation } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users.api';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useToast } from '@/lib/providers/ToastProvider';
import type { UpdateProfilePayload } from '@/types';

export function useUpdateProfile() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: UpdateProfilePayload) =>
      usersApi.updateProfile(data).then((r) => r.data),

    onSuccess: (updatedUser) => {
      // Patch only mutable fields — preserve orgId and other AuthUser fields
      const { user, org, accessToken } = useAuthStore.getState();
      if (user && org && accessToken) {
        useAuthStore.getState().setAuth({
          user: { ...user, name: updatedUser.name, avatarUrl: updatedUser.avatarUrl ?? null },
          org,
          accessToken,
        });
      }
      toast({ variant: 'success', title: 'Perfil atualizado' });
    },

    onError: () => {
      toast({ variant: 'error', title: 'Erro ao salvar perfil', description: 'Tente novamente' });
    },
  });
}
