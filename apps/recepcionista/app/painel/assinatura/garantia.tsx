"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { emReais } from "@/lib/billing/preco";

/**
 * O botão da garantia.
 *
 * Pede confirmação antes, porque o pedido encerra o plano e não tem volta — e diz
 * o que vai acontecer ANTES do clique, não depois. Quem decide se há direito é o
 * servidor; este botão só existe quando a regra já disse que sim.
 */
export function BotaoDaGarantia() {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [devolvido, setDevolvido] = useState<string | null>(null);

  const pedir = async () => {
    setEnviando(true);
    setErro("");
    try {
      const res = await fetch("/api/billing/garantia", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.devolvido) {
        setErro(json.error ?? "Não consegui concluir agora. Tenta de novo?");
        return;
      }
      setDevolvido(emReais(json.valorCents));
      router.refresh();
    } catch {
      setErro("Falha de conexão. Tenta de novo?");
    } finally {
      setEnviando(false);
    }
  };

  if (devolvido) {
    return (
      <p className="mt-4 rounded-xl bg-panel-bg p-3 text-sm text-panel-ink">
        Pronto: devolvemos {devolvido}. O comprovante foi para o seu e-mail.
      </p>
    );
  }

  return (
    <div className="mt-4">
      {confirmando ? (
        <div className="rounded-xl border border-panel-line bg-panel-bg p-4">
          <p className="text-sm text-panel-ink">
            Confirmando, devolvemos tudo o que você pagou no período da garantia e encerramos o
            seu plano agora. Sua lista continua sua, para ler e exportar quando quiser.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={pedir}
              disabled={enviando}
              className="rounded-xl bg-amber px-4 py-2.5 text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
            >
              {enviando ? "Devolvendo…" : "Confirmar a devolução"}
            </button>
            <button
              onClick={() => setConfirmando(false)}
              disabled={enviando}
              className="rounded-xl border border-panel-line bg-panel-card px-4 py-2.5 text-sm text-panel-ink disabled:opacity-40"
            >
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmando(true)}
          className="rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-night transition hover:brightness-110"
        >
          Pedir minha garantia
        </button>
      )}
      {erro && <p className="mt-3 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
