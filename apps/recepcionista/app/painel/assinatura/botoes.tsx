"use client";

import { useEffect, useState } from "react";
import type { PlanoId } from "@/lib/billing/planos";
import { trackInitiateCheckout, trackPurchase } from "@/lib/analytics/pixel";
import { ModalSalvarConta } from "@/components/painel/modal-salvar-conta";

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

export type CompraConfirmada = {
  id: string;
  valor: number;
  plano: string;
};

export function BotoesAssinatura({
  opcoes,
  portal,
  compraConfirmada,
  comprouComSucesso,
}: {
  opcoes: OpcaoDePlano[];
  /** Texto do botão do portal da Stripe; null quando não há assinatura no cartão para gerenciar. */
  portal: string | null;
  compraConfirmada?: CompraConfirmada | null;
  comprouComSucesso?: boolean;
}) {
  const [abrindo, setAbrindo] = useState<PlanoId | "portal" | null>(null);
  const [erro, setErro] = useState("");
  const [modalSalvarAberto, setModalSalvarAberto] = useState(false);
  const [planoPendente, setPlanoPendente] = useState<PlanoId | null>(null);

  useEffect(() => {
    // SÓ dispara evento Purchase se a compra foi REALMENTE verificada no banco pelo servidor.
    // Nunca dispara apenas por ?ok=1 na URL.
    if (!compraConfirmada) return;

    try {
      const chave = `nx_purchased_${compraConfirmada.id}`;
      if (!sessionStorage.getItem(chave)) {
        sessionStorage.setItem(chave, "1");
        trackPurchase(compraConfirmada.valor, compraConfirmada.plano, compraConfirmada.id);
      }
    } catch {
      // Ignora erro de storage
    }
  }, [compraConfirmada]);

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
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (json?.precisaSalvarConta) {
          setPlanoPendente(destino !== "portal" ? destino : null);
          setModalSalvarAberto(true);
          return;
        }
        setErro(json.error ?? "Não consegui abrir agora. Tenta de novo?");
        return;
      }

      if (!json?.url) {
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

      <ModalSalvarConta
        aberto={modalSalvarAberto}
        aoFechar={() => setModalSalvarAberto(false)}
        aoSalvarSucesso={async () => {
          setModalSalvarAberto(false);
          if (planoPendente) {
            await abrir(planoPendente);
          }
        }}
      />
    </div>
  );
}
