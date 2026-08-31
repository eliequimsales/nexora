"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-night px-6 text-center text-mist">
      <p className="font-mono text-sm text-amber">algo deu errado</p>
      <h1 className="mt-3 font-display text-3xl font-bold">Erro inesperado</h1>
      <p className="mt-3 max-w-md text-mist/60">
        Nossa equipe já registrou o problema. Tente novamente — se persistir, recarregue a página.
      </p>
      <button
        onClick={reset}
        className="mt-8 rounded-xl bg-amber px-6 py-3 text-sm font-semibold text-night transition hover:brightness-110"
      >
        Tentar novamente
      </button>
    </div>
  );
}
