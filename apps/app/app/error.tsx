'use client';

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-xs font-mono text-status-error tracking-widest uppercase mb-4">
          Erro
        </p>
        <h1 className="text-2xl font-semibold text-text-primary mb-2">
          Algo deu errado
        </h1>
        <p className="text-sm text-text-secondary mb-8">
          Ocorreu um erro inesperado. Nossa equipe foi notificada.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-surface border border-brand-border text-sm text-text-primary hover:bg-brand-surface-2 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
