"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MINUTOS_SEM_RESPOSTA } from "@/lib/atendente/constantes";
import { horarioFalado } from "@/lib/atendente/datas";
import {
  apresentacao,
  conversaDeExemplo,
  JEITOS,
  NOME_DO_JEITO,
  textosDoJeito,
  type Bolha,
  type Jeito,
} from "@/lib/atendente/jeitos";

/**
 * A DEMONSTRAÇÃO DO ATENDENTE VIRTUAL — E ELA DIZ QUE É EXEMPLO.
 *
 * O visitante escolhe a cena e o jeito de falar e vê a conversa acontecer, com
 * "digitando…". O negócio e os horários são fictícios; os textos não: saem dos
 * mesmos textos prontos que o motor usa com os clientes de verdade
 * (lib/atendente/jeitos.ts). Cada cena mostra algo que o Atendente faz de fato.
 */

type Linha = Bolha | { de: "aviso"; texto: string };
type Cena = "NOITE" | "DOMINGO" | "LOJA_CHEIA";

const EMPRESA = "Barbearia do Léo";
const NOME = "Bia";

/** Horário de exemplo — o mesmo formato que o Atendente usa para falar o seu. */
const HORARIO_DE_EXEMPLO = horarioFalado([
  { day: 0, open: "09:00", close: "19:00", closed: true },
  ...[1, 2, 3, 4, 5].map((day) => ({ day, open: "09:00", close: "19:00", closed: false })),
  { day: 6, open: "09:00", close: "14:00", closed: false },
]);

const CENAS: { id: Cena; titulo: string; subtitulo: string }[] = [
  { id: "NOITE", titulo: "22h, pedindo horário", subtitulo: "Loja fechada: ele responde e marca" },
  { id: "DOMINGO", titulo: "Domingo, perguntando preço", subtitulo: "Preço do cadastro, sem inventar" },
  {
    id: "LOJA_CHEIA",
    titulo: `Loja cheia, ${MINUTOS_SEM_RESPOSTA} min sem resposta`,
    subtitulo: "Ele entra quando ninguém responde",
  },
];

function linhasDaCena(cena: Cena, jeito: Jeito): Linha[] {
  const t = textosDoJeito(jeito);
  const ap = apresentacao({ nome: NOME, empresa: EMPRESA });

  if (cena === "NOITE") {
    return conversaDeExemplo(jeito, {
      empresa: EMPRESA,
      nome: NOME,
      cliente: "Rafael",
      servico: "Corte",
      detalhe: "R$ 45,00, 40 min",
      opcoes: ["1 · amanhã, 9h30 com Léo", "2 · amanhã, 11h com Léo", "3 · amanhã, 16h40 com Diego"],
      escolhida: { quando: "Amanhã, às 11h", profissional: "Léo" },
      volta: "amanhã às 9h",
      cumprimento: "Boa noite",
    });
  }

  if (cena === "DOMINGO") {
    return [
      { de: "cliente", texto: "Bom dia! Quanto custa a barba?" },
      {
        de: "atendente",
        texto: `${t.saudacao({ cumprimento: "Bom dia", cliente: "Carla", apresentacao: ap })} ${t.contextoFechado("segunda às 9h")}`,
      },
      { de: "atendente", texto: `${t.preco({ servico: "Barba", preco: "R$ 35,00", duracao: "30 min" })} ${t.convite}` },
      { de: "cliente", texto: "Quero! Uma barba segunda de manhã" },
      {
        de: "atendente",
        texto: [
          t.ofertaLead({ servico: "Barba", detalhe: "R$ 35,00, 30 min", quando: "segunda" }),
          "1 · seg, 9h com Léo",
          "2 · seg, 10h30 com Diego",
          "3 · seg, 11h30 com Léo",
          t.respondaComNumero,
        ].join("\n"),
      },
    ];
  }

  return [
    { de: "cliente", texto: "Boa tarde! Vocês fecham que horas hoje?" },
    { de: "aviso", texto: `${MINUTOS_SEM_RESPOSTA} minutos sem resposta — a equipe está atendendo` },
    {
      de: "atendente",
      texto: `${t.saudacao({ cumprimento: "Boa tarde", cliente: "Paulo", apresentacao: ap })} ${t.contextoExpediente}`,
    },
    { de: "atendente", texto: `Funcionamos ${HORARIO_DE_EXEMPLO}. ${t.convite}` },
  ];
}

/** Quanto tempo cada coisa leva na tela: o ritmo de uma conversa de verdade. */
const PAUSA_INICIAL_MS = 500;
const DIGITANDO_MS = 1_200;
const DEPOIS_DO_CLIENTE_MS = 900;
const DEPOIS_DO_ATENDENTE_MS = 700;

export function DemoAtendente() {
  const [cena, setCena] = useState<Cena>("NOITE");
  const [jeito, setJeito] = useState<Jeito>("ACOLHEDOR");
  const [rodada, setRodada] = useState(0);
  const [visiveis, setVisiveis] = useState(0);
  const [digitando, setDigitando] = useState(false);
  const conversa = useRef<HTMLDivElement>(null);

  const linhas = useMemo(() => linhasDaCena(cena, jeito), [cena, jeito]);

  useEffect(() => {
    setVisiveis(0);
    setDigitando(false);
    // Quem pediu menos movimento vê a conversa inteira de uma vez.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisiveis(linhas.length);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    let quando = PAUSA_INICIAL_MS;
    linhas.forEach((linha, i) => {
      if (linha.de === "atendente") {
        timers.push(setTimeout(() => setDigitando(true), quando));
        quando += DIGITANDO_MS;
      }
      timers.push(
        setTimeout(() => {
          setDigitando(false);
          setVisiveis(i + 1);
        }, quando),
      );
      quando += linha.de === "cliente" ? DEPOIS_DO_CLIENTE_MS : DEPOIS_DO_ATENDENTE_MS;
    });
    return () => timers.forEach(clearTimeout);
  }, [linhas, rodada]);

  // A bolha nova sempre à vista, como no WhatsApp — rolando só a conversa, nunca a página.
  useEffect(() => {
    const caixa = conversa.current;
    if (caixa) caixa.scrollTo({ top: caixa.scrollHeight, behavior: "smooth" });
  }, [visiveis, digitando]);

  const terminou = visiveis >= linhas.length && !digitando;

  return (
    <div className="w-full">
      <div className="mb-3 grid gap-2 sm:grid-cols-3" role="group" aria-label="Escolha a cena">
        {CENAS.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={cena === c.id}
            onClick={() => setCena(c.id)}
            className={`rounded-lg border px-3 py-2 text-left transition-colors ${
              cena === c.id
                ? "border-nx-gold/60 bg-nx-gold/10"
                : "border-nx-border bg-nx-surface hover:border-nx-border-2"
            }`}
          >
            <span className={`block text-xs font-semibold ${cena === c.id ? "text-nx-gold" : "text-nx-primary"}`}>
              {c.titulo}
            </span>
            <span className="mt-0.5 block text-[11px] leading-tight text-nx-muted">{c.subtitulo}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-nx-border-2 bg-wa-frame shadow-nx-panel">
        <div className="flex items-center gap-3 border-b border-nx-border bg-nx-surface-2 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nx-gold font-bold text-nx-bg">
            L
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-nx-primary">{EMPRESA}</p>
            <p className="text-xs text-nx-muted">{digitando ? "digitando…" : "online"}</p>
          </div>
          <span className="rounded-full border border-nx-border bg-nx-surface px-2 py-0.5 text-[10px] font-medium text-nx-muted">
            Exemplo
          </span>
        </div>

        <div ref={conversa} className="h-[23rem] space-y-2 overflow-y-auto px-3 py-4" aria-live="polite">
          {linhas.slice(0, visiveis).map((linha, i) =>
            linha.de === "aviso" ? (
              <p key={i} className="mx-auto w-fit rounded-full bg-nx-surface-3 px-3 py-1 text-center text-[11px] text-nx-muted">
                {linha.texto}
              </p>
            ) : (
              <div key={i} className={linha.de === "cliente" ? "flex justify-start" : "flex justify-end"}>
                <p
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-[13px] leading-snug text-nx-primary ${
                    linha.de === "cliente" ? "rounded-tl-sm bg-wa-in" : "rounded-tr-sm bg-wa-out"
                  }`}
                >
                  {linha.texto}
                </p>
              </div>
            ),
          )}
          {digitando && (
            <div className="flex justify-end">
              <span className="rounded-2xl rounded-tr-sm bg-wa-out px-3 py-2 text-xs text-nx-secondary">digitando…</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-nx-border bg-nx-surface-2 px-3 py-2.5">
          <div className="flex gap-1" role="group" aria-label="Jeito de falar">
            {JEITOS.map((j) => (
              <button
                key={j}
                type="button"
                aria-pressed={jeito === j}
                onClick={() => setJeito(j)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  jeito === j ? "bg-nx-gold text-nx-bg" : "text-nx-secondary hover:text-nx-primary"
                }`}
              >
                {NOME_DO_JEITO[j]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setRodada((r) => r + 1)}
            disabled={!terminou}
            className="text-[11px] font-semibold text-nx-gold transition-opacity hover:underline disabled:opacity-40"
          >
            Ver de novo
          </button>
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] leading-relaxed text-nx-muted">
        Exemplo com negócio e horários fictícios. Os textos são os que o Atendente usa com os seus clientes.
      </p>
    </div>
  );
}
