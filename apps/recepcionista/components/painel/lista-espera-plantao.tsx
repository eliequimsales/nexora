"use client";

import { useState } from "react";

/**
 * BOTÃO / FORMULÁRIO DE LISTA DE ESPERA DO PLANTÃO (Nexora Completo)
 *
 * Registra o interesse do cliente no degrau do Plantão noturno (Fase 0).
 */
export function ListaDeEsperaPlantao() {
  const [salvando, setSalvando] = useState(false);
  const [inscrito, setInscrito] = useState(false);

  async function inscrever() {
    setSalvando(true);
    try {
      const res = await fetch("/api/plantao/gatilho", { method: "POST" });
      if (res.ok) {
        setInscrito(true);
      }
    } finally {
      setSalvando(false);
    }
  }

  if (inscrito) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800">
        <span aria-hidden="true">✓</span> Você está na lista de espera
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={inscrever}
      disabled={salvando}
      className="inline-flex items-center justify-center rounded-xl border border-panel-line bg-panel-card px-3.5 py-2 text-xs font-semibold text-panel-ink shadow-sm transition hover:bg-panel-bg disabled:opacity-50"
    >
      {salvando ? "Anotando…" : "Quero ser avisado no lançamento"}
    </button>
  );
}
