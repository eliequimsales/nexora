"use client";

import { useState } from "react";

export function BotaoEsperaCompleto() {
  const [salvando, setSalvando] = useState(false);
  const [naLista, setNaLista] = useState(false);

  const entrar = async () => {
    setSalvando(true);
    try {
      const res = await fetch("/api/plantao/gatilho", { method: "POST" });
      if (res.ok) {
        setNaLista(true);
      }
    } catch {
      // Ignora erro de rede
    } finally {
      setSalvando(false);
    }
  };

  if (naLista) {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-center">
        <p className="text-xs font-semibold text-emerald-400">
          ✓ Você está na lista de espera do Plantão!
        </p>
        <p className="mt-1 text-[11px] text-gray-400">
          Avisaremos em primeira mão assim que for liberado.
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={entrar}
      disabled={salvando}
      className="w-full rounded-xl border border-gray-700 bg-gray-900/80 px-4 py-3 text-sm font-semibold text-gray-300 transition hover:bg-gray-800 hover:text-white disabled:opacity-50"
    >
      {salvando ? "Salvando…" : "Entrar na lista de espera →"}
    </button>
  );
}
