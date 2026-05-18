'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { RecoveryChannel } from '@/types';

export interface PreviewRecoveryResponse {
  leadId: string;
  leadName: string;
  channel: RecoveryChannel;
  recipient: string;
  message: string;
}

/**
 * Gera o texto da mensagem de recuperação SEM enviar.
 * Usado no modo manual do piloto — o barbeiro copia/cola no WhatsApp dele.
 */
export function usePreviewRecovery() {
  return useMutation({
    mutationFn: async (input: { leadId: string; channel?: RecoveryChannel }) => {
      const response = await apiClient.post<PreviewRecoveryResponse>(
        `/leads/${input.leadId}/preview-recovery`,
        { channel: input.channel },
      );
      return response.data;
    },
  });
}
