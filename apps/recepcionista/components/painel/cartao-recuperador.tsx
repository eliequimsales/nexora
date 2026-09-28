"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CHAVE_DISPENSADO = "nexora:aviso-recuperador-dispensado";

export type CartaoRecuperadorProps = {
  emRisco?: number;
  totalClientes?: number;
  temPlanoCompleto?: boolean;
};

/**
 * CARTÃO DO RECUPERADOR DE CLIENTES (Plano Completo)
 *
 * Apresenta o poder de recuperação da Nexora de forma limpa, direta e sem alarmismo.
 * Direciona para o Plano Completo (R$ 197/mês) com simplicidade e clareza.
 */
export function CartaoDoRecuperador({
  emRisco = 0,
  totalClientes = 0,
  temPlanoCompleto = false,
}: CartaoRecuperadorProps) {
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

  if (dispensado) return null;

  // Estado: Usuário já possui o Plano Completo ativo
  if (temPlanoCompleto) {
    return (
      <section
        aria-labelledby="recuperador-titulo"
        className="relative overflow-hidden rounded-2xl border border-amber/40 bg-gradient-to-br from-amber-50/50 via-panel-card to-panel-card p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-deep">
            <span aria-hidden="true">⚡</span> Recuperador Automático de Clientes
          </span>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Plano Completo Ativo
            </span>
            <button
              type="button"
              onClick={dispensar}
              title="Fechar aviso"
              aria-label="Fechar aviso"
              className="rounded-lg p-1 text-panel-sub transition hover:bg-amber/10 hover:text-panel-ink"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-2.5">
          <h2
            id="recuperador-titulo"
            className="font-display text-lg font-bold tracking-tight text-panel-ink sm:text-xl"
          >
            Seu Recuperador está ativo e monitorando seus clientes.
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-panel-sub">
            Toda segunda-feira a Nexora separa quem parou de agendar e monta a Onda Semanal com mensagens prontas no WhatsApp.
          </p>
        </div>

        {emRisco > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-panel-ink">
            <span>🔥</span>
            <span>
              <strong>{emRisco} {emRisco === 1 ? "cliente afastado" : "clientes afastados"}</strong> na sua lista prontos para reativar.
            </span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/painel/onda"
            className="inline-flex items-center justify-center rounded-xl bg-amber px-4 py-2 text-xs font-bold text-night shadow-sm transition hover:brightness-110"
          >
            Abrir Reativar clientes (Onda) <span aria-hidden="true" className="ml-1">→</span>
          </Link>
        </div>
      </section>
    );
  }

  // Estado Principal: Conscientização e Conversão para o Plano Completo (Recuperador)
  return (
    <section
      aria-labelledby="recuperador-titulo"
      className="relative overflow-hidden rounded-2xl border border-amber/40 bg-gradient-to-br from-amber-50/60 via-panel-card to-panel-card p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-deep">
          <span aria-hidden="true">⚡</span> Recuperador Automático de Clientes
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-amber/40 bg-amber/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-deep">
            Exclusivo Plano Completo
          </span>
          <button
            type="button"
            onClick={dispensar}
            title="Fechar aviso"
            aria-label="Fechar aviso"
            className="rounded-lg p-1 text-panel-sub transition hover:bg-amber/10 hover:text-panel-ink"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-2.5">
        <h2
          id="recuperador-titulo"
          className="font-display text-lg font-bold tracking-tight text-panel-ink sm:text-xl"
        >
          Reative clientes que pararam de voltar pelo WhatsApp.
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-panel-sub">
          A Nexora identifica quem sumiu e cria mensagens prontas para você enviar e recuperar agendamentos com 1 clique.
        </p>
      </div>

      {emRisco > 0 ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-panel-ink">
          <span>🔥</span>
          <span>
            <strong>{emRisco} {emRisco === 1 ? "cliente já passou" : "clientes já passaram"}</strong> do tempo normal de retorno.
          </span>
        </div>
      ) : totalClientes > 0 ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber/30 bg-amber/5 px-3 py-2 text-xs text-panel-ink">
          <span>✨</span>
          <span>Sua lista está organizada e pronta para o acompanhamento automático.</span>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Link
          href="/painel/assinatura"
          className="inline-flex items-center justify-center rounded-xl bg-amber px-4 py-2 text-xs font-bold text-night shadow-sm transition hover:brightness-110"
        >
          Ativar Plano Completo — R$ 197/mês <span aria-hidden="true" className="ml-1">→</span>
        </Link>
        <Link
          href="/painel/onda"
          className="inline-flex items-center justify-center rounded-xl border border-panel-line bg-panel-card px-3.5 py-2 text-xs font-semibold text-panel-ink transition hover:bg-panel-bg"
        >
          Ver como funciona a Onda
        </Link>
      </div>
    </section>
  );
}
