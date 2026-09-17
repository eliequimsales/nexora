"use client";

import { useEffect, useState } from "react";
import type { PlanoId } from "@/lib/billing/planos";
import { trackInitiateCheckout, trackPurchase } from "@/lib/analytics/pixel";

/**
 * As ações da tela de conta. Regra Zero: sempre existe uma, e ela EXECUTA —
 * nunca é um link para "fale com o suporte".
 *
 * Quais planos aparecem, e se existe portal, quem decide é `acoesDaConta` no
 * servidor — a mesma regra que a rota do checkout aplica. Botão que a rota
 * recusaria não chega a ser desenhado.
 */

export type OpcaoDePlano = {
  plano: PlanoId;
  titulo: string;
  /** Vem do servidor, das constantes de preço: o botão nunca anuncia um valor diferente do cobrado. */
  preco: string;
  detalhe: string;
  acao: string;
};

export function BotoesAssinatura({
  opcoes,
  portal,
  comprouComSucesso,
}: {
  opcoes: OpcaoDePlano[];
  /** Texto do botão do portal da Stripe; null quando não há assinatura no cartão para gerenciar. */
  portal: string | null;
  comprouComSucesso?: boolean;
}) {
  const [abrindo, setAbrindo] = useState<PlanoId | "portal" | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!comprouComSucesso) return;
    try {
      const sessionId =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("session_id") || "ok"
          : "ok";
      const chave = `nx_purchased_${sessionId}`;
      if (!sessionStorage.getItem(chave)) {
        sessionStorage.setItem(chave, "1");
        trackPurchase(97.0, "assinatura_stripe");
      }
    } catch {
      trackPurchase(97.0, "assinatura_stripe");
    }
  }, [comprouComSucesso]);

  const abrir = async (destino: PlanoId | "portal") => {
    setAbrindo(destino);
    setErro("");
    try {
      if (destino !== "portal") {
        const opcao = opcoes.find((o) => o.plano === destino);
        trackInitiateCheckout(destino, opcao?.preco);
      }

      const res =
        destino === "portal"
          ? await fetch("/api/billing/portal", { method: "POST" })
          : await fetch("/api/billing/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ plano: destino }),
            });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setErro(json.error ?? "Não consegui abrir agora. Tenta de novo?");
        return;
      }
      window.location.href = json.url;
    } catch {
      setErro("Falha de conexão. Tenta de novo?");
    } finally {
      setAbrindo(null);
    }
  };

  return (
    <div className="mt-5">
      {/*
        Só o clique em andamento desabilita. Travar os botões quando a cobrança não
        está configurada parecia cuidado e era o contrário: a API sabe exatamente
        qual variável falta, e um botão morto garante que ninguém nunca leia essa
        resposta.
      */}
      {opcoes.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-3">
          {opcoes.map((o) => (
            <li
              key={o.plano}
              className="flex flex-col rounded-xl border border-panel-line bg-panel-bg p-4"
            >
              <p className="text-sm font-medium text-panel-ink">{o.titulo}</p>
              <p className="mt-1 font-display text-2xl text-panel-ink tabular-nums">{o.preco}</p>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-panel-sub">{o.detalhe}</p>
              <button
                onClick={() => abrir(o.plano)}
                disabled={abrindo !== null}
                className="mt-4 rounded-xl bg-amber px-4 py-2.5 text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
              >
                {abrindo === o.plano ? "Abrindo…" : o.acao}
              </button>
            </li>
          ))}
        </ul>
      )}

      {portal && (
        <button
          onClick={() => abrir("portal")}
          disabled={abrindo !== null}
          className={`rounded-xl px-5 py-3 text-sm font-semibold transition hover:brightness-110 disabled:opacity-40 ${
            opcoes.length > 0
              ? "mt-4 border border-panel-line bg-panel-card text-panel-ink"
              : "bg-amber text-night"
          }`}
        >
          {abrindo === "portal" ? "Abrindo…" : portal}
        </button>
      )}

      {erro && <p className="mt-3 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
