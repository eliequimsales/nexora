"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { TelaDoAtendente, Tom } from "@/lib/atendente/tela";
import { emReais } from "@/lib/billing/preco";
import { ModalConectarWhatsApp } from "@/components/painel/modal-conectar-whatsapp";

/**
 * DEPOIS DE LIGAR: COMO ELE ESTÁ E O QUE PRECISA DE VOCÊ.
 *
 * O estado em uma frase, o que ele fez desde que a loja fechou numa linha, e a
 * lista do que precisa do dono — só quando existe, cada item com o botão que
 * resolve.
 */

const COR_DO_TOM: Record<Tom, string> = {
  ATENDENDO: "bg-emerald-500 animate-pulse",
  DE_OLHO: "bg-emerald-500",
  ESPERANDO: "bg-emerald-500",
  PARADO: "bg-red-500",
  DESLIGADO: "bg-panel-line",
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Pergunta que ele não sabia vira resposta ensinada. */
const ehPergunta = (motivo: string) => /pergunt|não soube|cadastro/i.test(motivo);

export function Situacao({
  tela,
  aoMudarTela,
}: {
  tela: TelaDoAtendente;
  aoMudarTela: (tela: TelaDoAtendente) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [conectando, setConectando] = useState(false);

  async function pedir(url: string, metodo: "PUT" | "POST", corpo: unknown) {
    setOcupado(true);
    setErro("");
    try {
      const r = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) {
        setErro(j?.error ?? "Não consegui agora. Tente de novo.");
        return;
      }
      aoMudarTela(j);
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  // O modal refaz a conexão quando o callback muda: os dois precisam ser estáveis.
  const fecharConexao = useCallback(() => setConectando(false), []);
  const conectou = useCallback(async () => {
    setConectando(false);
    const r = await fetch("/api/atendente").catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    if (j) aoMudarTela(j);
  }, [aoMudarTela]);

  const f = tela.enquantoFechado;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-panel-line bg-panel-card p-5">
        <p className="flex items-center gap-2.5 font-display text-lg text-panel-ink">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${COR_DO_TOM[tela.estado.tom]}`} aria-hidden="true" />
          {tela.estado.texto}
        </p>
        {f.conversas > 0 && (
          <p className="mt-2 text-sm text-panel-sub">
            Desde que você fechou: {plural(f.conversas, "conversa", "conversas")}
            {f.marcados > 0 ? ` · ${plural(f.marcados, "horário marcado", "horários marcados")}` : ""}
            {f.valorMarcadoCents > 0 ? ` · ${emReais(f.valorMarcadoCents)}` : ""}
          </p>
        )}
        <p className="mt-1 text-xs text-panel-sub">{tela.uso.texto}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!tela.whatsappLigado && (
            <button
              type="button"
              onClick={() => setConectando(true)}
              className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-night transition hover:brightness-110"
            >
              Ligar meu WhatsApp
            </button>
          )}
          <button
            type="button"
            disabled={ocupado}
            onClick={() => pedir("/api/atendente", "PUT", { fecharHoje: !tela.sabe.fechadoHoje })}
            title={tela.sabe.fechadoHoje ? undefined : "Hoje ele atende o dia todo"}
            className="rounded-xl border border-panel-line px-4 py-2 text-sm font-semibold text-panel-ink transition hover:border-amber disabled:opacity-60"
          >
            {tela.sabe.fechadoHoje ? "Reabrir hoje" : "Fechar hoje"}
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => pedir("/api/atendente/ligar", "POST", { ligar: false })}
            className="ml-auto rounded-xl px-3 py-2 text-sm font-semibold text-panel-sub transition hover:text-red-600 disabled:opacity-60"
          >
            Desligar
          </button>
        </div>
        {erro && (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {erro}
          </p>
        )}
      </section>

      {tela.precisaDeVoce.length > 0 && (
        <section className="rounded-2xl border border-panel-line bg-panel-card">
          <p className="px-5 pt-4 font-display text-lg text-panel-ink">Precisa de você</p>
          <ul className="mt-2 divide-y divide-panel-line">
            {tela.precisaDeVoce.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/painel/conversas/${p.conversationId}`}
                    className="inline-flex items-center gap-2 font-semibold text-panel-ink hover:underline"
                  >
                    {p.urgente && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                        Urgente
                      </span>
                    )}
                    {p.cliente}
                  </Link>
                  <p className="text-sm text-panel-sub">{p.motivo}</p>
                </div>
                <a
                  href={`https://wa.me/${p.telefone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-amber px-3 py-1.5 text-xs font-bold text-night transition hover:brightness-110"
                >
                  Responder
                </a>
                {ehPergunta(p.motivo) && (
                  <Link href="/painel/treinamento" className="text-xs font-semibold text-amber-deep hover:underline">
                    Ensinar
                  </Link>
                )}
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => pedir("/api/atendente", "PUT", { resolver: p.id })}
                  aria-label="Marcar como resolvido"
                  title="Resolvido"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-panel-line text-xs text-panel-sub transition hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-60"
                >
                  ✓
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ModalConectarWhatsApp aberto={conectando} aoFechar={fecharConexao} aoConectar={conectou} />
    </div>
  );
}
