'use client';

import { Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface AiInsightCardProps {
  text: string | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string | null;
  onGenerate: () => void;
}

export function AiInsightCard({ text, isLoading, isError, errorMessage, onGenerate }: AiInsightCardProps) {
  return (
    <div className="rounded-xl border border-brand-amber/30 bg-brand-amber/5 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-brand-amber" />
          <p className="text-sm font-semibold text-text-primary">Análise da IA</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onGenerate}
          disabled={isLoading}
          className="text-xs text-brand-amber hover:text-brand-amber/80"
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          {text ? 'Atualizar' : 'Gerar análise'}
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <div className="h-3 skeleton w-full" />
          <div className="h-3 skeleton w-4/5" />
          <div className="h-3 skeleton w-3/5" />
        </div>
      )}

      {!isLoading && isError && (
        <p className="text-xs text-status-error">
          {errorMessage ?? 'Erro ao gerar análise. Tente novamente.'}
        </p>
      )}

      {!isLoading && !isError && text && (
        <p className="text-sm text-text-secondary leading-relaxed">{text}</p>
      )}

      {!isLoading && !isError && !text && (
        <p className="text-xs text-text-muted">
          Clique em &quot;Gerar análise&quot; para receber um resumo inteligente do período.
        </p>
      )}
    </div>
  );
}
