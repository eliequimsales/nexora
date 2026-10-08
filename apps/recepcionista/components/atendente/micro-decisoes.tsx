"use client";

import { useState } from "react";
import type { TelaDoAtendente } from "@/lib/atendente/tela";

export function MicroDecisoes({
  tela,
  aoAjustar,
}: {
  tela: TelaDoAtendente;
  aoAjustar: (dados: Record<string, unknown>) => void;
}) {
  const [salvando, setSalvando] = useState<string | null>(null);

  async function mudarMarcaDireto(valor: boolean) {
    if (tela.marcaDireto === valor) return;
    setSalvando("marcaDireto");
    await aoAjustar({ marcaDireto: valor });
    setSalvando(null);
  }

  async function mudarExpediente(valor: boolean) {
    if (tela.expediente === valor) return;
    setSalvando("expediente");
    await aoAjustar({ expediente: valor });
    setSalvando(null);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-panel-line bg-panel-card p-5 shadow-xs">
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full bg-amber/20 text-xs font-bold text-amber-deep"
          aria-hidden="true"
        >
          ⚡
        </span>
        <h3 className="font-display text-sm font-bold text-panel-ink">
          Como a Nexora deve se comportar
        </h3>
      </div>

      <div className="space-y-4">
        {/* Micro-decisão 1: Agendamentos */}
        <div className="rounded-xl border border-panel-line bg-white p-4 space-y-3">
          <p className="text-xs font-bold text-panel-ink">
            Quando um cliente pedir um horário, quem deve confirmar?
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              disabled={salvando === "marcaDireto"}
              onClick={() => mudarMarcaDireto(false)}
              className={`rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition ${
                !tela.marcaDireto
                  ? "border-amber bg-amber/10 text-panel-ink ring-1 ring-amber"
                  : "border-panel-line bg-panel-bg text-panel-sub hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Eu confirmo antes</span>
                {!tela.marcaDireto && <span className="text-amber-deep font-bold">✓</span>}
              </div>
            </button>

            <button
              type="button"
              disabled={salvando === "marcaDireto"}
              onClick={() => mudarMarcaDireto(true)}
              className={`rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition ${
                tela.marcaDireto
                  ? "border-amber bg-amber/10 text-panel-ink ring-1 ring-amber"
                  : "border-panel-line bg-panel-bg text-panel-sub hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>A Nexora confirma direto</span>
                {tela.marcaDireto && <span className="text-amber-deep font-bold">✓</span>}
              </div>
            </button>
          </div>

          <div className="rounded-lg bg-panel-bg/70 p-2.5 text-[11px] text-panel-sub leading-relaxed">
            {!tela.marcaDireto ? (
              <p>
                👉 <strong>Como ela vai responder:</strong> Vou perguntar o serviço e horário desejado,
                anotar o pedido e avisar que você precisa confirmar. Nada entra na agenda sem seu aval.
              </p>
            ) : (
              <p>
                👉 <strong>Como ela vai responder:</strong> Vou consultar seus horários livres e
                confirmar o agendamento imediatamente para o cliente.
              </p>
            )}
          </div>
        </div>

        {/* Micro-decisão 2: Horário de atendimento */}
        <div className="rounded-xl border border-panel-line bg-white p-4 space-y-3">
          <p className="text-xs font-bold text-panel-ink">
            Em quais horários a Nexora deve responder no WhatsApp?
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              disabled={salvando === "expediente"}
              onClick={() => mudarExpediente(false)}
              className={`rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition ${
                !tela.expediente
                  ? "border-amber bg-amber/10 text-panel-ink ring-1 ring-amber"
                  : "border-panel-line bg-panel-bg text-panel-sub hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Só fora do expediente</span>
                {!tela.expediente && <span className="text-amber-deep font-bold">✓</span>}
              </div>
            </button>

            <button
              type="button"
              disabled={salvando === "expediente"}
              onClick={() => mudarExpediente(true)}
              className={`rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition ${
                tela.expediente
                  ? "border-amber bg-amber/10 text-panel-ink ring-1 ring-amber"
                  : "border-panel-line bg-panel-bg text-panel-sub hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>24 horas (dia e noite)</span>
                {tela.expediente && <span className="text-amber-deep font-bold">✓</span>}
              </div>
            </button>
          </div>

          <div className="rounded-lg bg-panel-bg/70 p-2.5 text-[11px] text-panel-sub leading-relaxed">
            {!tela.expediente ? (
              <p>
                👉 <strong>Como ela vai funcionar:</strong> O atendente só assume o WhatsApp quando sua
                empresa estiver fechada, à noite e nos fins de semana.
              </p>
            ) : (
              <p>
                👉 <strong>Como ela vai funcionar:</strong> O atendente cuida de tudo 24h. Durante o
                expediente, se um cliente chamar e você não responder em até 5 minutos, ele assume.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
