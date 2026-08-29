"use client";

import { useState } from "react";

export function Descadastrar({ empresa, token }: { empresa: string; token: string }) {
  const [estado, setEstado] = useState<"pronto" | "enviando" | "feito">("pronto");
  const [erro, setErro] = useState("");

  const sair = async () => {
    setEstado("enviando");
    setErro("");
    try {
      const res = await fetch("/api/descadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa, token }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setErro(json.error ?? "Não consegui processar agora.");
        setEstado("pronto");
        return;
      }
      setEstado("feito");
    } catch {
      setErro("Falha de conexão. Tenta de novo?");
      setEstado("pronto");
    }
  };

  if (estado === "feito") {
    return (
      <p className="mt-6 rounded-xl border border-leaf/30 bg-leaf/10 p-4 text-sm text-mist">
        Pronto. Você não recebe mais esses e-mails. Se um dia mudar de ideia, é só falar
        com a gente.
      </p>
    );
  }

  return (
    <div className="mt-6">
      <button
        onClick={sair}
        disabled={estado === "enviando"}
        className="rounded-xl bg-mist px-5 py-3 text-sm font-semibold text-night transition hover:brightness-90 disabled:opacity-40"
      >
        {estado === "enviando" ? "Tirando…" : "Sim, parar de receber"}
      </button>
      {erro && <p className="mt-3 text-sm text-red-300">{erro}</p>}
    </div>
  );
}
