"use client";

import { useState } from "react";

/**
 * O aviso de e-mail não confirmado.
 *
 * Termina em AÇÃO e não em informação: o botão reenvia o link ali mesmo. Um
 * aviso que só diz "confirme seu e-mail" transfere para a pessoa o trabalho de
 * descobrir como — e ela vai procurar o e-mail antigo, não achar, e desistir.
 */
export function AvisoVerificarEmail() {
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado" | "erro">("parado");

  const reenviar = async () => {
    setEstado("enviando");
    try {
      const res = await fetch("/api/auth/verificar", { method: "POST" });
      setEstado(res.ok ? "enviado" : "erro");
    } catch {
      setEstado("erro");
    }
  };

  return (
    <div className="border-b border-amber-deep/40 bg-amber/15">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2.5 text-sm">
        <span className="text-panel-ink">
          <strong className="font-semibold">Confirme seu e-mail.</strong> É o que garante que
          você consiga recuperar a senha e receber o comprovante da assinatura.
        </span>

        {estado === "enviado" ? (
          <span className="font-semibold text-amber-deep">Link novo enviado — olha a caixa de entrada.</span>
        ) : (
          <button
            onClick={reenviar}
            disabled={estado === "enviando"}
            className="font-semibold text-amber-deep underline underline-offset-2 disabled:opacity-50"
          >
            {estado === "enviando" ? "Enviando…" : "Reenviar o link"}
          </button>
        )}

        {estado === "erro" && (
          <span className="text-red-700">Não consegui enviar agora. Tenta de novo em alguns minutos.</span>
        )}
      </div>
    </div>
  );
}
