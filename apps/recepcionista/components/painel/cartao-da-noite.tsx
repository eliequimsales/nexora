"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GatilhoDaNoite } from "@/lib/plantao/noite";

/**
 * CARTÃO DO GATILHO DA NOITE (Fase 0 do Plantão)
 *
 * Apresenta a quantidade de mensagens que chegaram com a loja fechada na semana.
 * Permite ao dono ver as conversas pendentes ou testar o simulador do Plantão.
 */
export function CartaoDaNoite({ inicial }: { inicial?: GatilhoDaNoite | null }) {
  const [dados, setDados] = useState<GatilhoDaNoite | null>(inicial ?? null);
  const [carregando, setCarregando] = useState(!inicial);

  useEffect(() => {
    if (inicial) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/plantao/gatilho");
        if (!res.ok) return;
        const j = await res.json();
        if (vivo) setDados(j);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [inicial]);

  if (carregando || !dados) return null;

  // Se tem WhatsApp conectado mas nenhuma mensagem fora do horário, não precisa alarmar
  if (dados.whatsappConectado && dados.totalForaDoHorario === 0) return null;

  return (
    <section
      aria-labelledby="gatilho-noite-titulo"
      className="relative overflow-hidden rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/50 via-panel-card to-panel-card p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-900">
          <span aria-hidden="true">🌙</span> Enquanto vocês estavam fechados
        </span>
        <span className="rounded-full border border-indigo-200 bg-indigo-100/60 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-indigo-800">
          semana {dados.semana}
        </span>
      </div>

      <div className="mt-4">
        <p className="font-display text-3xl font-extrabold tracking-tight text-panel-ink sm:text-4xl tabular-nums">
          {dados.totalForaDoHorario} {dados.totalForaDoHorario === 1 ? "mensagem" : "mensagens"}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-panel-sub">
          chegaram fora do horário nesta semana.{" "}
          {dados.semResposta > 0 ? (
            <>
              <strong className="font-semibold text-panel-ink">
                {dados.semResposta} {dados.semResposta === 1 ? "ainda não teve resposta" : "ainda não tiveram resposta"}
              </strong>
              {dados.maisAntiga && (
                <span>
                  {" "}— a mais antiga, {dados.maisAntiga.nome ? `de ${dados.maisAntiga.nome}` : ""}, {dados.maisAntiga.quandoTexto}.
                </span>
              )}
            </>
          ) : (
            <span>Todas as conversas já foram respondidas por você.</span>
          )}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/painel/atendente"
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Testar o Plantão <span aria-hidden="true" className="ml-1.5">→</span>
        </Link>
        <Link
          href="/painel/conversas"
          className="inline-flex items-center justify-center rounded-xl border border-panel-line bg-panel-card px-4 py-2.5 text-sm font-medium text-panel-ink transition hover:bg-panel-bg"
        >
          Ver as mensagens
        </Link>
      </div>

      <p className="mt-4 text-[11px] text-panel-sub">
        {dados.ehExemplo ? "exemplo · o número vem do WhatsApp conectado" : "o número vem do WhatsApp conectado"}
      </p>
    </section>
  );
}
