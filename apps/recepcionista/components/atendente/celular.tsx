"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { conversaDeExemplo, type Jeito } from "@/lib/atendente/jeitos";
import type { TelaDoAtendente } from "@/lib/atendente/tela";

/**
 * O CELULAR — SIMULADOR ULTRA-REALISTA DO WHATSAPP.
 *
 * Visual idêntico ao da landing page: smartphone moderno, sem barras de rolagem
 * horizontais, mensagens perfeitamente alinhadas, opções clicáveis e selo de
 * agendamento confirmado na agenda.
 */

type Mensagem = { de: "cliente" | "atendente"; texto: string; fonte?: string; agendamentoConfirmado?: boolean };

const SUGESTOES = ["🕒 Tem horário amanhã?", "💳 Quanto custa?", "📍 Onde fica?"];
const PAUSA_ENTRE_BOLHAS_MS = 650;
const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

function formatarHoraAgora(): string {
  const agora = new Date();
  const h = String(agora.getHours()).padStart(2, "0");
  const m = String(agora.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

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
  const [teste, setTeste] = useState<Mensagem[] | null>(null);
  const [estado, setEstado] = useState<{ tipo?: string } | null>(null);
  const [entrada, setEntrada] = useState("");
  const [digitando, setDigitando] = useState(false);
  const [erro, setErro] = useState("");
  const [horaStatus, setHoraStatus] = useState("09:41");
  const rolagem = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHoraStatus(formatarHoraAgora());
  }, []);

  const exemplo = useMemo<Mensagem[]>(() => {
    const bolhas = conversaDeExemplo(jeito, { ...tela.exemplo.dados, nome });
    return bolhas.map((b, idx) => ({
      de: b.de,
      texto: b.texto,
      agendamentoConfirmado: idx === bolhas.length - 1 && b.de === "atendente",
    }));
  }, [jeito, nome, tela.exemplo.dados]);

  const mensagens = teste ?? exemplo;

  useEffect(() => {
    rolagem.current?.scrollTo({ top: rolagem.current.scrollHeight, behavior: "smooth" });
  }, [mensagens.length, digitando]);

  async function enviar(texto: string) {
    const limpo = texto.replace(/^[^\p{L}\p{N}]+/u, "").trim();
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
          marcaDireto: true,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) {
        setErro(j?.error ?? "O teste não rodou agora. Tente de novo.");
        return;
      }
      const respostas: string[] = j.mensagens ?? [];
      const fonte = Array.isArray(j.fontes) ? j.fontes.join(" · ") : undefined;
      const confirmou = Boolean(
        j.marcou ||
          (j.mensagens &&
            j.mensagens.some(
              (m: string) =>
                /(horário|agendamento|reserva|vaga)\s+(está\s+)?(confirmad|marcad)|está agendado|horário reservado/i.test(m) &&
                !/não tenho confirmad|anotado para a equipe/i.test(m),
            )),
      );
      for (let i = 0; i < respostas.length; i++) {
        if (i > 0) await esperar(PAUSA_ENTRE_BOLHAS_MS);
        setTeste((atual) => [
          ...(atual ?? []),
          {
            de: "atendente",
            texto: respostas[i],
            fonte,
            agendamentoConfirmado: i === respostas.length - 1 && confirmou,
          },
        ]);
      }
      setEstado(j.estado ?? null);
      aoTestar();
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    } finally {
      setDigitando(false);
    }
  }

  function recomecar() {
    setTeste(null);
    setEstado(null);
    setErro("");
  }

  const sugestoes =
    estado?.tipo === "HORARIO" ? ["2", ...SUGESTOES.slice(1)] : estado?.tipo === "SERVICO" ? ["1", ...SUGESTOES.slice(1)] : SUGESTOES;

  return (
    <div className="mx-auto w-full max-w-[420px] lg:sticky lg:top-6">
      {/* DISPOSITIVO SMARTPHONE ULTRA-REALISTA CENTRALIZADO (ESTILO LANDING PAGE) */}
      <div className="rounded-[3rem] border border-[#2A2E3D] bg-gradient-to-b from-[#2A2E3D] via-[#1A1D27] to-[#0E1017] p-3 shadow-2xl ring-1 ring-white/10">
        <div className="relative flex h-[580px] sm:h-[620px] flex-col overflow-hidden rounded-[2.35rem] bg-[#0B141A] border border-[#1E222D]">
          {/* BARRA DE STATUS DO DISPOSITIVO */}
          <div className="flex h-7 select-none items-center justify-between bg-[#202C33] px-6 pt-1 text-[11px] font-semibold text-white/80">
            <span>{horaStatus}</span>
            <div className="flex h-4 w-20 items-center justify-center rounded-full bg-black/90">
              <span className="h-2 w-2 rounded-full bg-black ring-1 ring-white/10" />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/90">
              <span className="text-[10px] font-bold">5G</span>
              <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 21l3.39-.62C9.27 20.74 10.6 21 12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z" />
              </svg>
              <span className="text-[10px]">98%</span>
            </div>
          </div>

          {/* CABEÇALHO DO WHATSAPP */}
          <div className="flex items-center justify-between border-b border-[#2A3942]/60 bg-[#202C33] px-3 py-2.5 shadow-sm">
            <div className="flex min-w-0 items-center gap-2.5">
              <svg className="h-4 w-4 text-[#8696A0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <div className="relative shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber to-amber-600 font-display text-base font-bold text-night shadow-inner">
                  {tela.empresa.trim().charAt(0).toUpperCase() || "N"}
                </div>
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#202C33] bg-[#25D366]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="truncate text-sm font-bold text-[#E9EDEF]">{tela.empresa}</p>
                  <svg className="h-3.5 w-3.5 shrink-0 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </div>
                <p className="text-[11px] text-[#8696A0]">
                  {digitando ? "digitando…" : teste ? "online agora" : "exemplo"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[#A7B2B8]">
              {teste && (
                <button
                  type="button"
                  onClick={recomecar}
                  aria-label="Recomeçar"
                  title="Recomeçar conversa"
                  className="rounded-full p-1.5 text-amber transition hover:bg-white/10"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5.1 15a7 7 0 0012.4 2M18.9 9A7 7 0 006.5 7" />
                  </svg>
                </button>
              )}
              <span className="rounded-full border border-[#2A3942] bg-[#182229] px-2 py-0.5 text-[10px] font-semibold text-[#8696A0]">
                Ao vivo
              </span>
            </div>
          </div>

          {/* ÁREA DE CONVERSA COM FUNDO DO WHATSAPP (SEM ROLAGEM HORIZONTAL) */}
          <div
            ref={rolagem}
            className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-3.5 py-4 scroll-smooth"
            style={{
              backgroundImage:
                "radial-gradient(#182229 0.75px, transparent 0.75px), radial-gradient(#182229 0.75px, #0B141A 0.75px)",
              backgroundSize: "30px 30px",
              backgroundPosition: "0 0, 15px 15px",
            }}
            aria-live="polite"
          >
            <div className="flex justify-center">
              <span className="rounded-lg bg-[#182229] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8696A0] shadow-sm">
                HOJE
              </span>
            </div>

            <div className="mx-auto max-w-[290px] rounded-lg bg-[#182229]/90 px-3 py-1.5 text-center text-[10px] leading-tight text-[#FFD279] shadow-sm">
              🔒 As mensagens são protegidas e enviadas em tempo real como no WhatsApp oficial.
            </div>

            {mensagens.map((m, i) => {
              const ehCliente = m.de === "cliente";
              return (
                <div key={i} className={`flex flex-col ${ehCliente ? "items-end" : "items-start"}`}>
                  <div
                    title={m.fonte}
                    className={`relative max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-md break-words [overflow-wrap:anywhere] ${
                      ehCliente
                        ? "rounded-tr-xs bg-[#005C4B] text-[#E9EDEF]"
                        : "rounded-tl-xs bg-[#202C33] text-[#E9EDEF]"
                    }`}
                  >
                    <p className="whitespace-pre-line break-words [overflow-wrap:anywhere]">{m.texto}</p>

                    {/* SELO DE CONFIRMAÇÃO DE AGENDAMENTO AUTOMÁTICO (IGUAL NA LANDING) */}
                    {m.agendamentoConfirmado && (
                      <div className="mt-2.5 rounded-xl border border-[#25D366]/40 bg-[#0B141A]/70 p-2.5 text-xs text-[#E9EDEF]">
                        <div className="flex items-center gap-1.5 font-bold text-[#25D366]">
                          <span>✓</span> Horário reservado automaticamente
                        </div>
                        <p className="mt-1 text-[11px] text-[#8696A0]">
                          Salvo na agenda da empresa! Cliente recebe confirmação e lembrete anti-falta.
                        </p>
                      </div>
                    )}

                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#8696A0]">
                      <span>{horaStatus}</span>
                      {ehCliente && (
                        <span className="font-bold text-[#53BDEB]" title="Lido">
                          ✓✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {digitando && (
              <div className="flex items-start">
                <div className="rounded-2xl rounded-tl-xs bg-[#202C33] px-4 py-3 shadow-md">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#8696A0] animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 rounded-full bg-[#8696A0] animate-bounce" style={{ animationDelay: "180ms" }} />
                    <span className="h-2 w-2 rounded-full bg-[#8696A0] animate-bounce" style={{ animationDelay: "360ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SUGESTÕES RÁPIDAS DE RESPOSTA */}
          <div className="flex flex-wrap gap-1.5 border-t border-[#1E222D]/60 bg-[#0B141A]/95 px-3 py-2">
            {sugestoes.map((s) => (
              <button
                key={s}
                type="button"
                disabled={digitando}
                onClick={() => enviar(s)}
                className="shrink-0 rounded-full border border-[#00A884]/40 bg-[#111B21] px-3 py-1 text-[11px] font-medium text-[#E9EDEF] shadow-sm transition hover:border-[#00A884] hover:bg-[#005C4B]/40 hover:text-white disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>

          {/* BARRA DE DIGITAÇÃO DO WHATSAPP */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void enviar(entrada);
            }}
            className="flex items-center gap-2 border-t border-[#2A3942]/50 bg-[#202C33] px-3 py-2.5"
          >
            <span className="text-lg text-[#8696A0] select-none" aria-hidden="true">
              😀
            </span>
            <input
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              maxLength={500}
              placeholder="Escreva como um cliente…"
              aria-label="Mensagem de teste"
              className="min-w-0 flex-1 rounded-full bg-[#2A3942] px-3.5 py-1.5 text-xs text-[#E9EDEF] placeholder:text-[#8696A0] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
            />
            <button
              type="submit"
              disabled={digitando || !entrada.trim()}
              aria-label="Enviar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00A884] text-white shadow transition hover:brightness-110 disabled:opacity-40"
            >
              <svg className="h-3.5 w-3.5 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </div>
      </div>
      {erro && (
        <p role="alert" className="mt-2 text-center text-xs text-red-600">
          {erro}
        </p>
      )}
    </div>
  );
}
