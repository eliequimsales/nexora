'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useQueryClient } from '@tanstack/react-query';
import type { OrgResponse } from '@/types';

export interface NexoraRecoverySettingsInput {
  inactivityDays?: number;
  whatsappTemplate?: string;
  emailTemplate?: string;
  whatsappEnabled?: boolean;
  emailEnabled?: boolean;
  zapiApiKey?: string;
  resendApiKey?: string;
}

/**
 * Hook para atualizar configurações de recuperação da Nexora.
 * Envia um PATCH para /organizations com a estrutura settings.nexoraRecovery.
 */
export function useNexoraSettings() {
  const queryClient = useQueryClient();

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (data: NexoraRecoverySettingsInput) => {
      const response = await apiClient.patch<OrgResponse>('/organizations', {
        settings: {
          nexoraRecovery: {
            inactivityDays: data.inactivityDays,
            whatsappTemplate: data.whatsappTemplate,
            emailTemplate: data.emailTemplate,
            whatsappEnabled: data.whatsappEnabled,
            emailEnabled: data.emailEnabled,
            zapiApiKey: data.zapiApiKey,
            resendApiKey: data.resendApiKey,
          },
        },
      });
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate org queries to refresh cached data
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  return { mutate, isPending, error };
}
