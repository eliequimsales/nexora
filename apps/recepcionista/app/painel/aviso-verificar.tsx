"use client";

import { useState } from "react";

/**
 * O aviso de e-mail não confirmado.
 *
 * Termina em AÇÃO e não em informação: o botão reenvia o link ali mesmo. Um
 * aviso que só diz "confirme seu e-mail" transfere para a pessoa o trabalho de
 * descobrir como — e ela vai procurar o e-mail antigo, não achar, e desistir.
 *
 * `semEnvioDeEmail` vem do servidor e muda a ação inteira: sem Resend ligado,
 * "reenviar o link" é um botão que promete um e-mail que não vai sair. No lugar
 * dele entra a liberação manual, com o preço escrito — a conta passa a valer
 * como confirmada sem que ninguém tenha provado que o endereço existe.
 */
export function AvisoVerificarEmail({ semEnvioDeEmail }: { semEnvioDeEmail: boolean }) {
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

  const liberar = async () => {
    setEstado("enviando");
    try {
      const res = await fetch("/api/auth/verificar/sem-email", { method: "POST" });
      // Recarrega em vez de esconder o aviso pelo estado local: o painel inteiro
      // é renderizado no servidor a partir de `emailVerificadoEm`, e é ele que
      // manda — não uma variável desta tela.
      if (res.ok) window.location.reload();
      else setEstado("erro");
    } catch {
      setEstado("erro");
    }
  };

  return (
    <div className="border-b border-amber-deep/40 bg-amber/15">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2.5 text-sm">
        {semEnvioDeEmail ? (
          <>
            <span className="text-panel-ink">
              <strong className="font-semibold">O envio de e-mail ainda não está ligado aqui.</strong>{" "}
              O link de confirmação não tem como sair. Você pode liberar sua conta agora — ela
              vai contar como confirmada <strong>sem a prova</strong> de que este endereço é
              seu, e fica registrado que foi assim.
            </span>
            <button
              onClick={liberar}
              disabled={estado === "enviando"}
              className="font-semibold text-amber-deep underline underline-offset-2 disabled:opacity-50"
            >
              {estado === "enviando" ? "Liberando…" : "Liberar minha conta assim mesmo"}
            </button>
          </>
        ) : (
          <>
            <span className="text-panel-ink">
              <strong className="font-semibold">Confirme seu e-mail.</strong> É o que garante que
              você consiga recuperar a senha e receber o comprovante da assinatura.
            </span>

            {estado === "enviado" ? (
              <span className="font-semibold text-amber-deep">
                Link novo enviado — olha a caixa de entrada.
              </span>
            ) : (
              <button
                onClick={reenviar}
                disabled={estado === "enviando"}
                className="font-semibold text-amber-deep underline underline-offset-2 disabled:opacity-50"
              >
                {estado === "enviando" ? "Enviando…" : "Reenviar o link"}
              </button>
            )}
          </>
        )}

        {estado === "erro" && (
          <span className="text-red-700">Não consegui agora. Tenta de novo em alguns minutos.</span>
        )}
      </div>
    </div>
  );
}
