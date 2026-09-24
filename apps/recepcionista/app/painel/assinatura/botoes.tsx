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

  const principal =
    opcoes.find((o) => o.plano === "mensal_cartao" || o.plano === "completo_cartao") ?? opcoes[0];
  const secundarias = opcoes.filter((o) => o.plano !== principal?.plano);

  return (
    <div>
      {/*
        Só o clique em andamento desabilita. Travar os botões quando a cobrança não
        está configurada parecia cuidado e era o contrário: a API sabe exatamente
        qual variável falta, e um botão morto garante que ninguém nunca leia essa
        resposta.
      */}
      {portal ? (
        <button
          onClick={() => abrir("portal")}
          disabled={abrindo !== null}
          className="w-full rounded-xl bg-amber py-3.5 px-4 text-sm font-bold text-night shadow-md transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
        >
          {abrindo === "portal" ? "Abrindo…" : portal}
        </button>
      ) : opcoes.length > 0 ? (
        <div className="space-y-3">
          {principal && (
            <button
              onClick={() => abrir(principal.plano)}
              disabled={abrindo !== null}
              className="w-full rounded-xl bg-amber py-3.5 px-4 text-sm font-bold text-night shadow-lg shadow-amber-500/20 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
            >
              {abrindo === principal.plano ? "Abrindo…" : `${principal.acao} — ${principal.preco} →`}
            </button>
          )}

          {secundarias.length > 0 && (
            <div
              className={`grid gap-2.5 ${
                secundarias.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
              }`}
            >
              {secundarias.map((o) => (
                <button
                  key={o.plano}
                  onClick={() => abrir(o.plano)}
                  disabled={abrindo !== null}
                  className="rounded-xl border border-gray-700 bg-gray-900/80 py-2.5 px-3 text-xs font-semibold text-gray-200 transition hover:bg-gray-800 hover:border-gray-600 disabled:opacity-40 text-center"
                >
                  {abrindo === o.plano ? "Abrindo…" : `${o.titulo} (${o.preco})`}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {erro && (
        <p className="mt-3 rounded-lg border border-red-800/60 bg-red-950/40 p-2.5 text-xs text-red-300">
          {erro}
        </p>
      )}
    </div>
  );
}
