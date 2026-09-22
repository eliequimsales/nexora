"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { conversaDeExemplo, type Jeito } from "@/lib/atendente/jeitos";
import type { TelaDoAtendente } from "@/lib/atendente/tela";

/**
 * O CELULAR — O PRÓPRIO PRODUTO É A EXPLICAÇÃO.
 *
 * Abre com a conversa de exemplo: o nome, o jeito e os horários livres do
 * negócio. Mudou o nome ou o jeito ao lado, a conversa muda junto. Quando o
 * dono escreve, vira teste de verdade — o mesmo motor que vai atender os
 * clientes, sem enviar nada e sem marcar nada. De onde veio cada fato fica no
 * título da bolha, para quem quiser conferir, sem poluir a conversa.
 */

type Mensagem = { de: "cliente" | "atendente"; texto: string; fonte?: string };

const SUGESTOES = ["Tem horário amanhã?", "Quanto custa?", "Onde fica?"];
/** O ritmo do WhatsApp de verdade: uma bolha por vez. */
const PAUSA_ENTRE_BOLHAS_MS = 700;
const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

export function Celular({
  tela,
  nome,
  jeito,
  aoTestar,
}: {
  tela: TelaDoAtendente;
  nome: string;
  jeito: Jeito;
  aoTestar: () => void;
}) {
  // null: mostrando o exemplo. Com mensagens: o teste do dono.
  const [teste, setTeste] = useState<Mensagem[] | null>(null);
  const [estado, setEstado] = useState<{ tipo?: string } | null>(null);
  const [entrada, setEntrada] = useState("");
  const [digitando, setDigitando] = useState(false);
  const [erro, setErro] = useState("");
  const [temVoz, setTemVoz] = useState(false);
  const rolagem = useRef<HTMLDivElement>(null);

  const exemplo = useMemo<Mensagem[]>(
    () => conversaDeExemplo(jeito, { ...tela.exemplo.dados, nome }),
    [jeito, nome, tela.exemplo.dados],
  );
  const mensagens = teste ?? exemplo;

  useEffect(() => {
    setTemVoz(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    rolagem.current?.scrollTo({ top: rolagem.current.scrollHeight, behavior: "smooth" });
  }, [mensagens.length, digitando]);

  async function enviar(texto: string) {
    const limpo = texto.trim();
    if (!limpo || digitando) return;
    const historico: Mensagem[] = [...(teste ?? []), { de: "cliente", texto: limpo }];
    setTeste(historico);
    setEntrada("");
    setErro("");
    setDigitando(true);
    try {
      const r = await fetch("/api/atendente/simular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagens: historico.slice(-30).map(({ de, texto: t }) => ({ de, texto: t })),
          estado,
          nome,
          jeito,
          marcaDireto: tela.marcaDireto,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) {
        setErro(j?.error ?? "O teste não rodou agora. Tente de novo.");
        return;
      }
      const respostas: string[] = j.mensagens ?? [];
      const fonte = Array.isArray(j.fontes) ? j.fontes.join(" · ") : undefined;
      for (let i = 0; i < respostas.length; i++) {
        if (i > 0) await esperar(PAUSA_ENTRE_BOLHAS_MS);
        setTeste((atual) => [...(atual ?? []), { de: "atendente", texto: respostas[i], fonte }]);
      }
      setEstado(j.estado ?? null);
      aoTestar();
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    } finally {
      setDigitando(false);
    }
  }

  function ouvir() {
    const fala = window.speechSynthesis;
    fala.cancel();
    const texto = mensagens
      .filter((m) => m.de === "atendente")
      .map((m) => m.texto)
      .join(". ")
      .replace(/\p{Extended_Pictographic}/gu, "")
      .replace(/ · /g, ", ");
    const frase = new SpeechSynthesisUtterance(texto);
    frase.lang = "pt-BR";
    const voz = fala.getVoices().find((v) => v.lang?.toLowerCase().startsWith("pt"));
    if (voz) frase.voice = voz;
    fala.speak(frase);
  }

  function recomecar() {
    setTeste(null);
    setEstado(null);
    setErro("");
  }

  // Depois de uma oferta, a resposta natural é o número — é assim que ele marca.
  const sugestoes =
    estado?.tipo === "HORARIO" ? ["2", ...SUGESTOES.slice(1)] : estado?.tipo === "SERVICO" ? ["1", ...SUGESTOES.slice(1)] : SUGESTOES;

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="overflow-hidden rounded-[2rem] border-4 border-night bg-wa-frame shadow-xl">
        <div className="flex items-center gap-3 bg-night-soft px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber font-display font-bold text-night">
            {tela.empresa.trim().charAt(0).toUpperCase() || "N"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-mist">{tela.empresa}</p>
            <p className="text-xs text-mist/60">
              {digitando ? "digitando…" : teste ? "teste · nada é enviado" : "exemplo"}
            </p>
          </div>
          {temVoz && (
            <button
              type="button"
              onClick={ouvir}
              aria-label="Ouvir a conversa"
              title="Ouvir"
              className="rounded-full p-2 text-mist/70 transition hover:bg-night hover:text-mist"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
              </svg>
            </button>
          )}
          {teste && (
            <button
              type="button"
              onClick={recomecar}
              aria-label="Recomeçar"
              title="Recomeçar"
              className="rounded-full p-2 text-mist/70 transition hover:bg-night hover:text-mist"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5.1 15a7 7 0 0012.4 2M18.9 9A7 7 0 006.5 7" />
              </svg>
            </button>
          )}
        </div>

        <div ref={rolagem} className="h-[28rem] space-y-2 overflow-y-auto px-3 py-4" aria-live="polite">
          {mensagens.map((m, i) => (
            <div key={i} className={m.de === "cliente" ? "flex justify-start" : "flex justify-end"}>
              <p
                title={m.fonte}
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-[13px] leading-snug text-mist ${
                  m.de === "cliente" ? "rounded-tl-sm bg-wa-in" : "rounded-tr-sm bg-wa-out"
                }`}
              >
                {m.texto}
              </p>
            </div>
          ))}
          {digitando && (
            <div className="flex justify-end">
              <span className="rounded-2xl rounded-tr-sm bg-wa-out px-3 py-2 text-xs text-mist/70">digitando…</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 bg-wa-frame px-3 pb-2">
          {sugestoes.map((s) => (
            <button
              key={s}
              type="button"
              disabled={digitando}
              onClick={() => enviar(s)}
              className="shrink-0 rounded-full border border-mist/20 px-3 py-1 text-xs text-mist/80 transition hover:border-amber hover:text-mist disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enviar(entrada);
          }}
          className="flex items-center gap-2 bg-night-soft px-3 py-3"
        >
          <input
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            maxLength={500}
            placeholder="Escreva como um cliente…"
            aria-label="Mensagem de teste"
            className="min-w-0 flex-1 rounded-full bg-wa-in px-4 py-2 text-sm text-mist placeholder:text-mist/40 focus:outline-none focus:ring-2 focus:ring-amber"
          />
          <button
            type="submit"
            disabled={digitando || !entrada.trim()}
            aria-label="Enviar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber text-night transition hover:brightness-110 disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3.4 20.4L21 12 3.4 3.6 3.4 10l12 2-12 2z" />
            </svg>
          </button>
        </form>
      </div>
      {erro && (
        <p role="alert" className="mt-2 text-center text-xs text-red-600">
          {erro}
        </p>
      )}
    </div>
  );
}
