'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ORG_QUERY_KEY } from './useOrgQuery';

interface AcceptLgpdResponse {
  acceptedAt: string;
  version: string;
}

/**
 * Marca o aceite do termo LGPD. Bloqueia todas as rotas de envio do
 * recovery service até ser chamado.
 */
export function useAcceptLgpd() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<AcceptLgpdResponse>(
        '/organizations/current/lgpd-accept',
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEY });
    },
  });
}
