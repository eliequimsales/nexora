'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface ImportPreview {
  totalRows: number;
  valid: Array<{
    name: string;
    phone: string | null;
    email: string | null;
    lastVisitAt: string | null;
    rowNumber: number;
  }>;
  duplicatesInFile: number;
  duplicatesInDb: number;
  invalid: Array<{ rowNumber: number; reason: string }>;
  created: number;
  updated: number;
}

/**
 * Faz upload do conteúdo CSV. Use `dryRun: true` para validar antes de gravar.
 */
export function useImportLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { csvContent: string; dryRun?: boolean }) => {
      const response = await apiClient.post<ImportPreview>('/leads/import', input);
      return response.data;
    },
    onSuccess: (data) => {
      // Apenas invalida cache quando foi import real (criou algo)
      if (data.created > 0) {
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'nexora-metrics'] });
      }
    },
  });
}
