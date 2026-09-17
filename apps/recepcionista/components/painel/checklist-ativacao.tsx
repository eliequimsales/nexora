"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  passosDaAtivacao,
  progressoDaAtivacao,
  type SinaisDaAtivacao,
} from "@/lib/painel/ativacao";

/**
 * COMECE POR AQUI — os três passos até a primeira mensagem.
 *
 * Fica no topo da tela em que o painel abre, e some sozinho quando os três
 * passos fecham: checklist que continua na frente depois de concluído vira
 * enfeite, e enfeite ensina o dono a ignorar o topo da tela.
 *
 * O passo 3 leva para a tela de reativar, nunca para uma conversa pronta: a
 * mensagem escrita é a ação que a assinatura cobre, e montar o link aqui seria
 * a mesma porta lateral que tests/porta-lateral.test.ts fechou.
 */

/** Preferência de quem olha, não dado do negócio: vive só neste navegador. */
const CHAVE = "nexora:comece-por-aqui-escondido";

export function ChecklistAtivacao({ sinais }: { sinais: SinaisDaAtivacao }) {
  const [escondido, setEscondido] = useState(false);

  useEffect(() => {
    try {
      setEscondido(window.localStorage.getItem(CHAVE) === "1");
    } catch {
      // Janela anônima ou armazenamento bloqueado: o checklist só aparece.
    }
  }, []);

  const guardar = (valor: boolean) => {
    setEscondido(valor);
    try {
      if (valor) window.localStorage.setItem(CHAVE, "1");
      else window.localStorage.removeItem(CHAVE);
    } catch {
      // Sem armazenamento, a escolha vale só até recarregar. Ninguém trava.
    }
  };

  const { feitos, total, concluida } = progressoDaAtivacao(sinais);

  // Terminou: sai da frente. O lugar dele passa a ser do dinheiro recuperado.
  if (concluida) return null;

  if (escondido) {
    return (
      <button
        type="button"
        onClick={() => guardar(false)}
        className="rounded-xl border border-panel-line bg-panel-card px-4 py-2.5 text-sm font-semibold text-panel-ink transition hover:border-amber"
      >
        Comece por aqui — {feitos} de {total} prontos
      </button>
    );
  }

  const passos = passosDaAtivacao(sinais);
  const atual = passos.find((p) => !p.feito && p.liberado) ?? passos.find((p) => !p.feito);

  return (
    <section className="rounded-2xl border border-amber/40 bg-amber/10 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-panel-ink">Comece por aqui</h2>
          <p className="mt-1 text-sm text-panel-sub">
            Três passos até a primeira mensagem sair. Leva poucos minutos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => guardar(true)}
          className="text-xs font-medium text-panel-sub underline underline-offset-4 transition hover:text-panel-ink"
        >
          Esconder
        </button>
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] tabular-nums text-panel-sub">
        {feitos} de {total} prontos
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-line">
        <div
          className="h-full bg-amber transition-all"
          style={{ width: `${(feitos / total) * 100}%` }}
        />
      </div>

      <ol className="mt-5 grid gap-3">
        {passos.map((passo) => {
          const ehAtual = passo.numero === atual?.numero;
          return (
            <li
              key={passo.numero}
              className={`rounded-xl border bg-panel-card p-4 transition ${
                ehAtual ? "border-amber" : "border-panel-line"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${
                    passo.feito
                      ? "bg-leaf text-night"
                      : ehAtual
                        ? "bg-amber text-night"
                        : "bg-panel-bg text-panel-sub"
                  }`}
                >
                  {passo.feito ? "✓" : passo.numero}
                </span>

                <div className="min-w-0">
                  <p
                    className={`font-semibold ${
                      passo.feito ? "text-panel-sub" : "text-panel-ink"
                    }`}
                  >
                    {passo.titulo}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-panel-sub">{passo.detalhe}</p>

                  {!passo.feito && passo.liberado && (
                    <Link
                      href={passo.acao.href}
                      className={`mt-3 inline-flex rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                        ehAtual
                          ? "bg-amber text-night hover:brightness-110"
                          : "border border-panel-line text-panel-ink hover:border-amber"
                      }`}
                    >
                      {passo.acao.texto}
                    </Link>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
