"use client";

import { useState } from "react";
import type { EstadoConta } from "@/lib/billing/acesso";

/**
 * A ação da tela de conta. Regra Zero: sempre existe uma, e ela EXECUTA —
 * nunca é um link para "fale com o suporte".
 */
export function BotoesAssinatura({
  estado,
  temAssinatura,
  habilitado,
  precoTexto,
}: {
  estado: EstadoConta;
  temAssinatura: boolean;
  habilitado: boolean;
  /** Vem do servidor: o botão nunca anuncia um preço diferente do cobrado. */
  precoTexto: string;
}) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const ir = async (rota: "checkout" | "portal") => {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch(`/api/billing/${rota}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setErro(json.error ?? "Não consegui abrir agora. Tenta de novo?");
        return;
      }
      window.location.href = json.url;
    } catch {
      setErro("Falha de conexão. Tenta de novo?");
    } finally {
      setCarregando(false);
    }
  };

  // Quem já tem assinatura resolve tudo no portal: trocar cartão, ver faturas,
  // cancelar e reativar. Quem nunca assinou vai para o checkout.
  const noPortal = temAssinatura && estado !== "TRIAL";
  const rota = noPortal ? "portal" : "checkout";

  const texto = noPortal
    ? estado === "BLOQUEADO" || estado === "TOLERANCIA"
      ? "Atualizar forma de pagamento"
      : estado === "CANCELADO" || estado === "CANCELADO_COM_ACESSO"
        ? "Reativar minha assinatura"
        : "Gerenciar assinatura"
    : `Assinar por ${precoTexto}/mês`;

  return (
    <div className="mt-5">
      <button
        onClick={() => ir(rota)}
        disabled={carregando || !habilitado}
        className="rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
      >
        {carregando ? "Abrindo…" : texto}
      </button>
      {erro && <p className="mt-3 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
