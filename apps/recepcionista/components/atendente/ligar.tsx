"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import type { TelaDoAtendente } from "@/lib/atendente/tela";
import { emReais, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { ModalConectarWhatsApp } from "@/components/painel/modal-conectar-whatsapp";

/**
 * O BOTÃO QUE LIGA O ATENDENTE — UMA AÇÃO, E A VERDADE NA HORA DE DECIDIR.
 *
 * O botão só funciona depois de um teste no celular. Ao apertar, a tela diz o
 * que o dono precisa saber antes de ligar (a conexão por QR Code não é a
 * oficial), e só então liga. Sem WhatsApp, abre a conexão e liga em seguida;
 * sem acesso, a recusa vira o botão que resolve. Depois da semana grátis, o
 * lugar do botão é o do plano.
 */

type Recusa = { error: string; acao: { texto: string; href: string } };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

const BOTAO = "rounded-xl bg-amber px-6 py-3.5 text-[1rem] font-bold text-night shadow-sm transition hover:brightness-110";

export function Ligar({
  tela,
  testado,
  aoMudarTela,
}: {
  tela: TelaDoAtendente;
  testado: boolean;
  aoMudarTela: (tela: TelaDoAtendente) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [ligando, setLigando] = useState(false);
  const [recusa, setRecusa] = useState<Recusa | null>(null);
  const [erro, setErro] = useState("");
  const [conectando, setConectando] = useState(false);

  async function ligar() {
    setLigando(true);
    setRecusa(null);
    setErro("");
    try {
      const r = await fetch("/api/atendente/ligar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ligar: true }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j) {
        aoMudarTela(j);
        return;
      }
      if (r.status === 409 && j?.faltando === "WHATSAPP") {
        setConectando(true);
        return;
      }
      if (r.status === 402 && j?.acao?.href) {
        setRecusa({ error: j.error, acao: j.acao });
        return;
      }
      setErro(j?.error ?? "Não consegui ligar agora. Tente de novo.");
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    } finally {
      setLigando(false);
    }
  }

  // O modal refaz a conexão quando o callback muda: por isso os dois são
  // estáveis, e o "ligar" mais recente é lido por referência.
  const ligarAgora = useRef(ligar);
  ligarAgora.current = ligar;
  const fecharConexao = useCallback(() => setConectando(false), []);
  const conectou = useCallback(() => {
    setConectando(false);
    void ligarAgora.current();
  }, []);

  if (tela.acesso === "SEMANA_ACABOU") {
    const s = tela.resultadoDaSemana;
    return (
      <section className="rounded-2xl border border-amber/40 bg-amber/10 p-5">
        <p className="font-display text-lg text-panel-ink">A semana grátis acabou</p>
        {s && s.conversas > 0 && (
          <p className="mt-1 text-sm text-panel-sub">
            Ele atendeu {plural(s.conversas, "conversa", "conversas")}
            {s.marcados > 0 ? ` e marcou ${plural(s.marcados, "horário", "horários")}` : ""}.
          </p>
        )}
        <Link href="/painel/assinatura" className={`${BOTAO} mt-4 block text-center`}>
          Continuar por {emReais(PRECO_MENSAL_CENTS)}/mês
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber/40 bg-amber/10 p-5">
      {recusa ? (
        <>
          <p className="text-sm text-panel-ink">{recusa.error}</p>
          <Link href={recusa.acao.href} className={`${BOTAO} mt-4 block text-center`}>
            {recusa.acao.texto}
          </Link>
        </>
      ) : confirmando ? (
        <>
          <p className="font-semibold text-panel-ink">Antes de ligar</p>
          <p className="mt-1 text-sm text-panel-sub">
            A conexão por QR Code não é a oficial do WhatsApp. Ele só responde quem escreveu primeiro —
            isso reduz o risco, mas não zera.
          </p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={ligar} disabled={ligando} className={`${BOTAO} flex-1 disabled:opacity-60`}>
              {ligando ? "Ligando…" : "Ligar agora"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="rounded-xl px-4 text-sm font-semibold text-panel-sub hover:text-panel-ink"
            >
              Voltar
            </button>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={!testado}
            onClick={() => setConfirmando(true)}
            className={`${BOTAO} w-full disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Ligar no meu WhatsApp
          </button>
          <p className="mt-2 text-center text-xs text-panel-sub">
            {testado ? tela.uso.texto : "Mande uma mensagem de teste no celular para liberar."}
          </p>
        </>
      )}
      {erro && (
        <p role="alert" className="mt-3 text-center text-xs text-red-600">
          {erro}
        </p>
      )}
      <ModalConectarWhatsApp aberto={conectando} aoFechar={fecharConexao} aoConectar={conectou} />
    </section>
  );
}
