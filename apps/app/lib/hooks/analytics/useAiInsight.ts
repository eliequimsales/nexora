'use client';

import { useState } from 'react';
import { analyticsApi, type AnalyticsParams } from '@/lib/api/analytics.api';

export function useAiInsight() {
  const [text, setText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function generate(params?: AnalyticsParams) {
    setIsLoading(true);
    setIsError(false);
    setErrorMessage(null);
    try {
      const res = await analyticsApi.generateAiSummary(params);
      setText(res.data);
    } catch (err) {
      setIsError(true);
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao gerar insight');
    } finally {
      setIsLoading(false);
    }
  }

  return { text, isLoading, isError, errorMessage, generate };
}
