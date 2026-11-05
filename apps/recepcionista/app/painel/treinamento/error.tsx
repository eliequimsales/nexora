"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function TreinamentoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log do erro de renderização para diagnóstico
    console.error("Erro capturado na Central de Treinamento:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-4xl py-8 px-4 sm:px-6">
      <div className="overflow-hidden rounded-3xl border border-amber/30 bg-panel-card p-8 sm:p-12 text-center shadow-[0_12px_44px_-24px_rgba(17,27,33,0.28)]">
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
            <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>

        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber/15 px-3 py-1 text-xs font-bold text-amber-deep">
          Central de Aprendizado do Nex
        </span>

        <h1 className="mt-3 font-display text-xl sm:text-2xl font-bold text-panel-ink">
          Central de Ensino Temporariamente Indisponível
        </h1>

        <p className="mx-auto mt-2 max-w-lg text-xs sm:text-sm text-panel-sub leading-relaxed">
          Tivemos uma oscilação momentânea ao carregar o repertório e as dúvidas do atendente.
          Fique tranquilo: seu atendente continua funcionando normalmente para responder os clientes no WhatsApp!
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
            <span>Ir para o Atendente Virtual</span>
            <svg
              aria-hidden="true"
              className="h-4 w-4 text-panel-sub"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14m-5-5 5 5-5 5" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
