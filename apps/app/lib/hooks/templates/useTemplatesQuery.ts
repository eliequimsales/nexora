'use client';

import { useQuery } from '@tanstack/react-query';
import { templatesApi } from '@/lib/api/templates.api';

export const TEMPLATES_QUERY_KEY = ['templates'] as const;

export function useTemplatesQuery() {
  return useQuery({
    queryKey: TEMPLATES_QUERY_KEY,
    queryFn: () => templatesApi.list().then((r) => r.data),
    staleTime: Infinity,
  });
}
