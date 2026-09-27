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
 * Apresenta o poder de recuperação da Nexora com o mesmo nível de
 * profissionalismo e conversão. Focado em conscientizar sobre clientes
 * sumidos e direcionar para o Plano Completo (R$ 197/mês).
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
        className="relative overflow-hidden rounded-2xl border border-amber/40 bg-gradient-to-br from-amber-50/50 via-panel-card to-panel-card p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-deep">
            <span aria-hidden="true">⚡</span> Recuperador Automático
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

        <div className="mt-3">
          <h2
            id="recuperador-titulo"
            className="font-display text-xl font-bold tracking-tight text-panel-ink sm:text-2xl"
          >
            Seu Recuperador está monitorando o retorno dos clientes.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-panel-sub">
            Toda segunda-feira a Nexora separa quem passou do tempo normal de retorno e monta a Onda Semanal com mensagens prontas para você enviar pelo WhatsApp.
          </p>
        </div>

        {emRisco > 0 && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber/40 bg-amber/10 p-3.5">
            <span className="text-lg">🔥</span>
            <div className="text-xs text-panel-ink leading-relaxed">
              <strong>Você tem {emRisco} {emRisco === 1 ? "cliente que passou" : "clientes que passaram"} do tempo normal de retorno na sua lista.</strong>{" "}
              Abra a Onda para reativar esses contatos em poucos minutos.
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/painel/onda"
            className="inline-flex items-center justify-center rounded-xl bg-amber px-5 py-2.5 text-sm font-bold text-night shadow-sm transition hover:brightness-110"
          >
            Abrir Reativar clientes (Onda) <span aria-hidden="true" className="ml-1.5">→</span>
          </Link>
        </div>
      </section>
    );
  }

  // Estado Principal: Conscientização e Conversão para o Plano Completo (Recuperador)
  return (
    <section
      aria-labelledby="recuperador-titulo"
      className="relative overflow-hidden rounded-2xl border border-amber/50 bg-gradient-to-br from-amber-50/70 via-panel-card to-panel-card p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-deep">
          <span aria-hidden="true">🔥</span> Recuperador Automático de Clientes
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

      <div className="mt-3">
        <h2
          id="recuperador-titulo"
          className="font-display text-xl font-bold tracking-tight text-panel-ink sm:text-2xl"
        >
          Clientes que somem não voltam sozinhos. O Recuperador traz eles de volta.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-panel-sub">
          Mais de 40% dos clientes deixam de voltar simplesmente porque a rotina atropela ou esquecem de agendar. Sem uma lembrança no momento certo, eles acabam fechando com o concorrente.
        </p>
      </div>

      {emRisco > 0 ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber/40 bg-amber/10 p-3.5">
          <span className="text-lg">⚠️</span>
          <div className="text-xs text-panel-ink leading-relaxed">
            <strong>Você tem {emRisco} {emRisco === 1 ? "cliente que já passou" : "clientes que já passaram"} do tempo normal de retorno.</strong>{" "}
            No Plano Completo, a Nexora gera a Onda Semanal com mensagens prontas para trazer esse dinheiro de volta pelo WhatsApp.
          </div>
        </div>
      ) : totalClientes > 0 ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber/30 bg-amber/5 p-3.5">
          <span className="text-lg">✨</span>
          <div className="text-xs text-panel-ink leading-relaxed">
            <strong>Sua lista de clientes cadastrados está pronta.</strong>{" "}
            Ativando o Plano Completo, a Nexora calcula o tempo de retorno de cada pessoa e avisa exatamente quando for a hora de chamar.
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber/30 bg-amber/5 p-3.5">
          <span className="text-lg">💡</span>
          <div className="text-xs text-panel-ink leading-relaxed">
            Cadastre seus clientes ou conecte o WhatsApp: a Nexora descobre o intervalo de retorno e faz o resgate para você sem complicação.
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href="/painel/assinatura"
          className="inline-flex items-center justify-center rounded-xl bg-amber px-5 py-2.5 text-sm font-bold text-night shadow-sm transition hover:brightness-110"
        >
          Ativar Plano Completo — R$ 197/mês <span aria-hidden="true" className="ml-1.5">→</span>
        </Link>
        <Link
          href="/painel/onda"
          className="inline-flex items-center justify-center rounded-xl border border-panel-line bg-panel-card px-4 py-2.5 text-sm font-semibold text-panel-ink transition hover:bg-panel-bg"
        >
          Ver como funciona a Onda
        </Link>
      </div>

      <p className="mt-4 text-[11px] text-panel-sub">
        O Plano Completo inclui o Atendente Virtual 24h + o Recuperador Automático de Clientes. Cancele quando quiser.
      </p>
    </section>
  );
}
