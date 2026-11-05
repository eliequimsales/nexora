"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function PainelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro capturado no Painel Nexora:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-4xl py-12 px-4 sm:px-6">
      <div className="overflow-hidden rounded-3xl border border-panel-line bg-panel-card p-8 sm:p-12 text-center shadow-[0_12px_44px_-24px_rgba(17,27,33,0.28)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber/20 text-amber-deep shadow-2xs">
          <svg
            aria-hidden="true"
            className="h-8 w-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 className="mt-4 font-display text-xl sm:text-2xl font-bold text-panel-ink">
          Algo deu errado nesta página
        </h1>

        <p className="mx-auto mt-2 max-w-lg text-xs sm:text-sm text-panel-sub leading-relaxed">
          Tivemos uma falha ao exibir este conteúdo. Você pode tentar recarregar ou navegar para outra área do seu painel pelo menu acima.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-amber px-6 py-2.5 text-xs sm:text-sm font-bold text-night shadow-xs hover:bg-amber-deep transition cursor-pointer active:scale-98"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            <span>Tentar novamente</span>
          </button>

          <Link
            href="/painel/atendente"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-panel-line bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-panel-ink shadow-2xs hover:border-amber transition"
          >
            <span>Atendente Virtual</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
