"use client";

import { useEffect, useMemo, useState } from "react";
import {
  conversaDeExemplo,
  DESCRICAO_DO_JEITO,
  JEITOS,
  NOME_DO_JEITO,
  type Bolha,
  type Jeito,
} from "@/lib/atendente/jeitos";
import type { TelaDoAtendente } from "@/lib/atendente/tela";

/**
 * PASSO 1 — QUEM ELE É E COMO FALA.
 *
 * O dono escolhe lendo (ou ouvindo) a mesma conversa escrita nos três jeitos,
 * com o nome do negócio, o primeiro serviço e os horários livres de verdade.
 * Nada de descrever um tom num campo vazio.
 */

const SUGESTOES = ["Bia", "Duda", "Lia", "Téo"];
const MAX_NOME = 30;

function Bolhas({ bolhas }: { bolhas: Bolha[] }) {
  return (
    <div className="space-y-1.5 rounded-xl bg-panel-bg p-3">
      {bolhas.map((b, i) => (
        <div key={i} className={b.de === "cliente" ? "flex justify-start" : "flex justify-end"}>
          <p
            className={`max-w-[90%] whitespace-pre-line rounded-2xl px-3 py-2 text-[13px] leading-snug text-panel-ink shadow-sm ${
              b.de === "cliente" ? "rounded-tl-sm bg-white" : "rounded-tr-sm border border-emerald-100 bg-emerald-50"
            }`}
          >
            {b.texto}
          </p>
        </div>
      ))}
    </div>
  );
}

/** O que a voz lê: as falas do Atendente, sem emoji e sem o "·" dos horários. */
function textoParaFala(bolhas: Bolha[]): string {
  return bolhas
    .filter((b) => b.de === "atendente")
    .map((b) => b.texto)
    .join(". ")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/ · /g, ", ");
}

export function PassoJeito({
  tela,
  nome,
  jeito,
  salvando,
  aoMudarNome,
  aoMudarJeito,
  aoContinuar,
}: {
  tela: TelaDoAtendente;
  nome: string;
  jeito: Jeito;
  salvando: boolean;
  aoMudarNome: (nome: string) => void;
  aoMudarJeito: (jeito: Jeito) => void;
  aoContinuar: () => void;
}) {
  const [temVoz, setTemVoz] = useState(false);
  const [falando, setFalando] = useState<Jeito | null>(null);

  // A voz é do navegador: só aparece o botão quando ela existe.
  useEffect(() => {
    setTemVoz(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const conversas = useMemo(
    () =>
      Object.fromEntries(JEITOS.map((j) => [j, conversaDeExemplo(j, { ...tela.exemplo.dados, nome })])) as Record<
        Jeito,
        Bolha[]
      >,
    [tela.exemplo.dados, nome],
  );

  function ouvir(j: Jeito) {
    const fala = window.speechSynthesis;
    fala.cancel();
    if (falando === j) {
      setFalando(null);
      return;
    }
    const frase = new SpeechSynthesisUtterance(textoParaFala(conversas[j]));
    frase.lang = "pt-BR";
    const voz = fala.getVoices().find((v) => v.lang?.toLowerCase().startsWith("pt"));
    if (voz) frase.voice = voz;
    frase.onend = () => setFalando(null);
    setFalando(j);
    fala.speak(frase);
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-panel-line bg-panel-card p-5">
        <label htmlFor="nome-do-atendente" className="font-display text-lg text-panel-ink">
          Como ele se chama?
        </label>
        <p className="mt-1 text-sm text-panel-sub">
          Ele se apresenta como atendente virtual da {tela.empresa}, uma vez por dia em cada conversa — nunca finge ser
          gente. Sem nome, diz “Aqui é o atendimento virtual da {tela.empresa}”.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            id="nome-do-atendente"
            value={nome}
            onChange={(e) => aoMudarNome(e.target.value.slice(0, MAX_NOME))}
            maxLength={MAX_NOME}
            placeholder="Ex.: Bia"
            autoComplete="off"
            className="w-44 rounded-xl border border-panel-line bg-white px-4 py-2.5 text-panel-ink focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/30"
          />
          {SUGESTOES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => aoMudarNome(s)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                nome === s
                  ? "border-amber bg-amber/15 font-semibold text-panel-ink"
                  : "border-panel-line text-panel-sub hover:border-amber/50 hover:text-panel-ink"
              }`}
            >
              {s}
            </button>
          ))}
          <button
            type="button"
            onClick={() => aoMudarNome("")}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              nome.trim() === ""
                ? "border-amber bg-amber/15 font-semibold text-panel-ink"
                : "border-panel-line text-panel-sub hover:border-amber/50 hover:text-panel-ink"
            }`}
          >
            Sem nome
          </button>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg text-panel-ink">Como ele fala</h2>
            <p className="text-sm text-panel-sub">A mesma conversa, nos três jeitos. Escolha o que tem a cara do seu negócio.</p>
          </div>
          <p className="text-xs text-panel-sub">
            {tela.exemplo.ehExemplo
              ? "Horários de exemplo: os seus aparecem aqui quando a agenda tiver serviço e vaga."
              : "Com os seus horários livres de verdade."}
          </p>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3" role="radiogroup" aria-label="Jeito de falar">
          {JEITOS.map((j) => {
            const escolhido = j === jeito;
            return (
              <div
                key={j}
                role="radio"
                aria-checked={escolhido}
                tabIndex={0}
                onClick={() => aoMudarJeito(j)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    aoMudarJeito(j);
                  }
                }}
                className={`cursor-pointer rounded-2xl border bg-panel-card p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber ${
                  escolhido ? "border-amber shadow-md ring-2 ring-amber/40" : "border-panel-line hover:border-amber/50"
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display font-semibold text-panel-ink">{NOME_DO_JEITO[j]}</p>
                    <p className="text-xs text-panel-sub">{DESCRICAO_DO_JEITO[j]}</p>
                  </div>
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      escolhido ? "border-amber bg-amber" : "border-panel-line"
                    }`}
                    aria-hidden="true"
                  >
                    {escolhido && <span className="h-2 w-2 rounded-full bg-night" />}
                  </span>
                </div>
                <Bolhas bolhas={conversas[j]} />
                {temVoz && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      ouvir(j);
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-deep hover:underline"
                  >
                    <span aria-hidden="true">{falando === j ? "■" : "▶"}</span>
                    {falando === j ? "Parar" : "Ouvir em voz alta"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={aoContinuar}
          disabled={salvando}
          className="rounded-xl bg-amber px-6 py-3 text-sm font-bold text-night transition hover:brightness-110 disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Continuar"}
        </button>
      </div>
    </section>
  );
}
