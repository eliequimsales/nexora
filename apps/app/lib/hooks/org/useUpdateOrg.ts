'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsApi } from '@/lib/api/organizations.api';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useToast } from '@/lib/providers/ToastProvider';
import { ORG_QUERY_KEY } from './useOrgQuery';
import type { UpdateOrgPayload } from '@/types';

export function useUpdateOrg() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: UpdateOrgPayload) => organizationsApi.update(data).then((r) => r.data),

    onSuccess: (updatedOrg) => {
      // Invalidate the org query so the next read is fresh
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEY });

      // Sync the auth store so useOrg() reflects the updated name/slug immediately
      const { user, accessToken } = useAuthStore.getState();
      if (user && accessToken) {
        useAuthStore.getState().setAuth({ user, org: updatedOrg, accessToken });
      }

      toast({ variant: 'success', title: 'Configurações salvas' });
    },

    onError: () => {
      toast({ variant: 'error', title: 'Erro ao salvar', description: 'Tente novamente' });
    },
  });
}
