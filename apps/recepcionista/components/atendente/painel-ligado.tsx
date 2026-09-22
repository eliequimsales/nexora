"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { emReais, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import type { TelaDoAtendente, Tom } from "@/lib/atendente/tela";
import { ModalConectarWhatsApp } from "@/components/painel/modal-conectar-whatsapp";
import { SemanaDesenhada } from "./semana";

/**
 * DEPOIS DE LIGAR: O QUE ELE FEZ E O QUE PRECISA DE VOCÊ.
 *
 * O estado em uma frase, o que aconteceu enquanto a loja estava fechada e a
 * lista do que precisa do dono — cada item com o botão que resolve. Regra Zero:
 * nada aqui é só informação.
 */

const COR_DO_TOM: Record<Tom, string> = {
  ATENDENDO: "bg-emerald-500 animate-pulse",
  DE_OLHO: "bg-amber",
  ESPERANDO: "bg-panel-sub",
  PARADO: "bg-red-500",
  DESLIGADO: "bg-panel-line",
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Pergunta que ele não sabia vira resposta ensinada: é o botão do Treinamento. */
const ehPergunta = (motivo: string) => /pergunt|não soube|cadastro/i.test(motivo);

function Numero({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div className="rounded-2xl border border-panel-line bg-panel-card p-4">
      <p className="font-display text-2xl font-bold tabular-nums text-panel-ink">{valor}</p>
      <p className="mt-0.5 text-xs text-panel-sub">{rotulo}</p>
    </div>
  );
}

export function PainelLigado({
  tela,
  aoMudarTela,
  aoAjustar,
}: {
  tela: TelaDoAtendente;
  aoMudarTela: (tela: TelaDoAtendente) => void;
  aoAjustar: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [conectando, setConectando] = useState(false);
  const quem = tela.nome.trim() || "O Atendente";
  const quemNoMeio = tela.nome.trim() || "o Atendente";

  async function pedir(url: string, metodo: "PUT" | "POST", corpo: unknown) {
    setOcupado(true);
    setErro("");
    try {
      const r = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) {
        setErro(j?.error ?? "Não consegui fazer isso agora. Tente de novo em instantes.");
        return;
      }
      aoMudarTela(j);
    } catch {
      setErro("Não consegui fazer isso agora. Confira a sua internet e tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  // O modal refaz a conexão quando o callback muda: os dois precisam ser estáveis.
  const fecharConexao = useCallback(() => setConectando(false), []);
  const conectou = useCallback(async () => {
    setConectando(false);
    // Religado o WhatsApp, a tela volta a dizer que ele está atendendo.
    const r = await fetch("/api/atendente").catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    if (j) aoMudarTela(j);
  }, [aoMudarTela]);

  const { enquantoFechado: fechado, resultadoDaSemana: semana } = tela;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-panel-line bg-panel-card p-5">
        <div className="flex items-start gap-3">
          <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${COR_DO_TOM[tela.estado.tom]}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg text-panel-ink">{tela.estado.texto}</p>
            <p className="mt-1 text-sm text-panel-sub">{tela.uso.texto}</p>
            {tela.sabe.fechadoHoje && (
              <p className="mt-1 text-sm text-panel-sub">Hoje está fechado: {quemNoMeio} atende o dia todo.</p>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {!tela.whatsappLigado && (
            <button
              type="button"
              onClick={() => setConectando(true)}
              className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-night transition hover:brightness-110"
            >
              Ligar meu WhatsApp
            </button>
          )}
          <button
            type="button"
            disabled={ocupado}
            onClick={() => pedir("/api/atendente", "PUT", { fecharHoje: !tela.sabe.fechadoHoje })}
            className="rounded-xl border border-panel-line px-4 py-2 text-sm font-semibold text-panel-ink transition hover:border-amber disabled:opacity-60"
          >
            {tela.sabe.fechadoHoje ? "Reabrir hoje" : "Fechar hoje"}
          </button>
          <button
            type="button"
            onClick={aoAjustar}
            className="rounded-xl border border-panel-line px-4 py-2 text-sm font-semibold text-panel-ink transition hover:border-amber"
          >
            Ajustar e testar
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => pedir("/api/atendente/ligar", "POST", { ligar: false })}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-panel-sub transition hover:text-red-600 disabled:opacity-60"
          >
            Desligar
          </button>
        </div>
        {erro && (
          <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {erro}
          </p>
        )}
      </section>

      {tela.acesso === "SEMANA_ACABOU" && (
        <section className="rounded-2xl border border-amber/40 bg-amber/10 p-6">
          <h2 className="font-display text-xl text-panel-ink">A semana por nossa conta terminou</h2>
          {semana && semana.conversas > 0 ? (
            <p className="mt-2 text-panel-ink">
              Nesses dias, {quemNoMeio} atendeu {plural(semana.conversas, "conversa", "conversas")}
              {semana.marcados > 0
                ? ` e marcou ${plural(semana.marcados, "horário", "horários")}${
                    semana.valorMarcadoCents > 0 ? ` — ${emReais(semana.valorMarcadoCents)} em atendimentos marcados` : ""
                  }`
                : ""}
              .
            </p>
          ) : (
            <p className="mt-2 text-panel-ink">Nesses dias, ninguém escreveu com a loja fechada.</p>
          )}
          <p className="mt-2 text-sm text-panel-sub">
            Para {quemNoMeio} continuar respondendo quando você não pode, é só escolher um plano. Suas conversas e sua
            agenda continuam suas.
          </p>
          <Link
            href="/painel/assinatura"
            className="mt-4 inline-block rounded-xl bg-amber px-5 py-3 text-sm font-bold text-night transition hover:brightness-110"
          >
            Continuar com o Atendente — {emReais(PRECO_MENSAL_CENTS)}/mês
          </Link>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display text-lg text-panel-ink">Enquanto você estava fechado</h2>
          <Link href="/painel/conversas" className="text-xs font-semibold text-amber-deep hover:underline">
            Ver as conversas
          </Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Numero valor={String(fechado.conversas)} rotulo={fechado.conversas === 1 ? "conversa atendida" : "conversas atendidas"} />
          <Numero valor={String(fechado.marcados)} rotulo={fechado.marcados === 1 ? "horário marcado" : "horários marcados"} />
          <Numero valor={emReais(fechado.valorMarcadoCents)} rotulo="em atendimentos marcados" />
        </div>
      </section>

      <section className="rounded-2xl border border-panel-line bg-panel-card">
        <div className="border-b border-panel-line px-5 py-4">
          <h2 className="font-display text-lg text-panel-ink">Precisa de você</h2>
          <p className="text-sm text-panel-sub">
            O que {quemNoMeio} não resolveu sozinho: pergunta fora do cadastro, pedido de falar com alguém, reclamação e
            urgência.
          </p>
        </div>
        {tela.precisaDeVoce.length === 0 ? (
          <p className="px-5 py-6 text-sm text-panel-sub">Nada esperando por você. {quem} anota aqui o que precisar.</p>
        ) : (
          <ul className="divide-y divide-panel-line">
            {tela.precisaDeVoce.map((p) => (
              <li key={p.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  {p.urgente && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-700">
                      Urgente
                    </span>
                  )}
                  <p className="font-semibold text-panel-ink">{p.cliente}</p>
                </div>
                <p className="mt-1 text-sm text-panel-sub">{p.motivo}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`https://wa.me/${p.telefone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-amber px-3 py-1.5 text-xs font-bold text-night transition hover:brightness-110"
                  >
                    Responder no WhatsApp
                  </a>
                  <Link
                    href={`/painel/conversas/${p.conversationId}`}
                    className="rounded-xl border border-panel-line px-3 py-1.5 text-xs font-semibold text-panel-ink transition hover:border-amber"
                  >
                    Ver a conversa
                  </Link>
                  {ehPergunta(p.motivo) && (
                    <Link
                      href="/painel/treinamento"
                      className="rounded-xl border border-panel-line px-3 py-1.5 text-xs font-semibold text-panel-ink transition hover:border-amber"
                    >
                      Ensinar a resposta
                    </Link>
                  )}
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => pedir("/api/atendente", "PUT", { resolver: p.id })}
                    className="rounded-xl px-3 py-1.5 text-xs font-semibold text-panel-sub transition hover:text-panel-ink disabled:opacity-60"
                  >
                    Resolvido
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="rounded-2xl border border-panel-line bg-panel-card p-5">
        <summary className="cursor-pointer font-display text-lg text-panel-ink">Quando {quemNoMeio} atende</summary>
        <div className="mt-4">
          <SemanaDesenhada dias={tela.semana.dias} texto={tela.semana.texto} nome={tela.nome} />
        </div>
      </details>

      <ModalConectarWhatsApp aberto={conectando} aoFechar={fecharConexao} aoConectar={conectou} />
    </div>
  );
}
