"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GatilhoDaNoite } from "@/lib/plantao/noite";

const CHAVE_DISPENSADO = "nexora:aviso-noite-dispensado";

/**
 * CARTÃO DO GATILHO DA NOITE (Fase 0 do Plantão / Conscientização do Atendente)
 *
 * Apresenta a quantidade de mensagens que chegaram com a loja fechada na semana.
 * Quando o WhatsApp ainda não está conectado, exibe uma mensagem realista de
 * conscientização comercial ("Enquanto você dormia, você pode ter perdido um cliente")
 * em vez de dados fictícios.
 */
export function CartaoDaNoite({ inicial }: { inicial?: GatilhoDaNoite | null }) {
  const [dados, setDados] = useState<GatilhoDaNoite | null>(inicial ?? null);
  const [carregando, setCarregando] = useState(!inicial);
  const [dispensado, setDispensado] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(CHAVE_DISPENSADO) === "1") {
        setDispensado(true);
      }
    } catch {}
  }, []);

  const dispensar = () => {
    setDispensado(true);
    try {
      window.localStorage.setItem(CHAVE_DISPENSADO, "1");
    } catch {}
  };

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

  // Estado de Conscientização: sem WhatsApp conectado ou em modo exemplo
  if (dados.ehExemplo || !dados.whatsappConectado) {
    if (dispensado) return null;

    return (
      <section
        aria-labelledby="gatilho-noite-titulo"
        className="relative overflow-hidden rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/50 via-panel-card to-panel-card p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-900">
            <span aria-hidden="true">🌙</span> Enquanto você dormia
          </span>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-indigo-200 bg-indigo-100/60 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-indigo-800">
              Atendente Virtual 24h
            </span>
            <button
              type="button"
              onClick={dispensar}
              title="Fechar aviso"
              aria-label="Fechar aviso"
              className="rounded-lg p-1 text-panel-sub transition hover:bg-indigo-100/50 hover:text-panel-ink"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-3">
          <h2
            id="gatilho-noite-titulo"
            className="font-display text-xl font-bold tracking-tight text-panel-ink sm:text-2xl"
          >
            Enquanto você dormia, você pode ter perdido um cliente para o concorrente.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-panel-sub">
            Mais de 30% das mensagens chegam à noite ou nos finais de semana. Sem um atendente virtual respondendo no seu WhatsApp na mesma hora, quem procura o seu serviço desiste ou fecha com o concorrente.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/painel/atendente"
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Ativar Atendente Virtual <span aria-hidden="true" className="ml-1.5">→</span>
          </Link>
          <Link
            href="/painel/configuracoes"
            className="inline-flex items-center justify-center rounded-xl border border-panel-line bg-panel-card px-4 py-2.5 text-sm font-medium text-panel-ink transition hover:bg-panel-bg"
          >
            Conectar WhatsApp
          </Link>
        </div>

        <p className="mt-4 text-[11px] text-panel-sub">
          Assim que seu WhatsApp estiver conectado, este cartão passa a monitorar em tempo real quantas mensagens chegam fora do seu horário.
        </p>
      </section>
    );
  }

  // Estado Real: WhatsApp conectado com mensagens recebidas fora do expediente
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
          Ativar Atendente Virtual <span aria-hidden="true" className="ml-1.5">→</span>
        </Link>
        <Link
          href="/painel/conversas"
          className="inline-flex items-center justify-center rounded-xl border border-panel-line bg-panel-card px-4 py-2.5 text-sm font-medium text-panel-ink transition hover:bg-panel-bg"
        >
          Ver as mensagens
        </Link>
      </div>

      <p className="mt-4 text-[11px] text-panel-sub">
        o número vem do WhatsApp conectado
      </p>
    </section>
  );
}
