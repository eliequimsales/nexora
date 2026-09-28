"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import { obterLinkWhatsAppDemo } from "@/lib/whatsapp/demo";

/**
 * SIMULADOR IMERSIVO DO ATENDENTE NO WHATSAPP
 *
 * Imersão gigante:
 * - Frame de smartphone moderno com entalhe/notch, hora real, wi-fi e bateria
 * - Barra superior do WhatsApp com avatar, online/digitando... e ações
 * - Balões de mensagem realistas com pontas (tail), carimbo de hora e tique duplo azul (✓✓)
 * - Efeitos sonoros sutis de envio e recebimento de mensagem (Web Audio API nativa)
 * - Modo Interativo (digitar ao vivo com IA ou sugestões rápidas)
 * - Modo Cenas prontas (reproduz 22h pedindo horário, domingo e loja cheia com os jeitos do motor)
 * - Seletor de nicho (Barbearia, Clínica, Salão, Geral)
 * - Chips de horários clicáveis e confirmação de agendamento rica
 */

type Nicho = "barbearia" | "clinica" | "salao" | "geral";
type LinhaCena = Bolha | { de: "aviso"; texto: string };
type Cena = "NOITE" | "DOMINGO" | "LOJA_CHEIA";

interface MensagemChat {
  id: string;
  de: "cliente" | "atendente";
  texto: string;
  hora: string;
  opcoes?: string[];
  agendamentoConfirmado?: boolean;
}

const EMPRESA_EXEMPLO = "Barbearia do Léo";
const NOME_EXEMPLO = "Bia";

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

function linhasDaCena(cena: Cena, jeito: Jeito): LinhaCena[] {
  const t = textosDoJeito(jeito);
  const ap = apresentacao({ nome: NOME_EXEMPLO, empresa: EMPRESA_EXEMPLO });

  if (cena === "NOITE") {
    return conversaDeExemplo(jeito, {
      empresa: EMPRESA_EXEMPLO,
      nome: NOME_EXEMPLO,
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

const CONFIG_NICHOS: Record<
  Nicho,
  {
    nomeEmpresa: string;
    nomeAtendente: string;
    avatarLetra: string;
    corAvatar: string;
    subtitulo: string;
    saudacaoInicial: string;
    sugestoes: string[];
  }
> = {
  barbearia: {
    nomeEmpresa: "Barbearia do Léo",
    nomeAtendente: "Bia",
    avatarLetra: "💈",
    corAvatar: "bg-[#1E293B]",
    subtitulo: "Cortes, Barba e Pigmentação",
    saudacaoInicial:
      "Olá! Sou a Bia, atendente virtual da Barbearia do Léo 💈\n\nPosso consultar horários livres com os barbeiros, informar preços ou agendar seu corte para hoje ou amanhã. Como posso te ajudar?",
    sugestoes: [
      "Tem horário amanhã às 14h?",
      "Quanto custa o corte e barba?",
      "Vocês atendem de madrugada?",
      "Como funciona o lembrete anti-falta?",
    ],
  },
  clinica: {
    nomeEmpresa: "Clínica Renove Estética",
    nomeAtendente: "Sofia",
    avatarLetra: "✨",
    corAvatar: "bg-[#334155]",
    subtitulo: "Procedimentos e Estética Avançada",
    saudacaoInicial:
      "Olá! Bem-vinda à Clínica Renove Estética ✨ Sou a Sofia, assistente virtual.\n\nQuer agendar uma avaliação, tirar dúvidas sobre valores (limpeza de pele, botox, drenagem) ou ver horários com as especialistas?",
    sugestoes: [
      "Tem horário livre amanhã de tarde?",
      "Quanto custa a limpeza de pele?",
      "Vocês atendem no sábado?",
      "Como funciona o lembrete?",
    ],
  },
  salao: {
    nomeEmpresa: "Studio Bella Hair",
    nomeAtendente: "Camila",
    avatarLetra: "💇‍♀️",
    corAvatar: "bg-[#3B1F2B]",
    subtitulo: "Cabelos, Unhas e Make",
    saudacaoInicial:
      "Olá! Sou a Camila do Studio Bella Hair 💇‍♀️\n\nPosso agendar escova, mechas, manicure ou tirar dúvidas sobre valores. Qual dia e horário você prefere?",
    sugestoes: [
      "Tem vaga amanhã para escova?",
      "Quanto custa o pé e mão?",
      "Vocês abrem aos domingos?",
      "Como agendo para amanhã?",
    ],
  },
  geral: {
    nomeEmpresa: "Nexora · Atendente Virtual",
    nomeAtendente: "Bia",
    avatarLetra: "✦",
    corAvatar: "bg-nx-gold",
    subtitulo: "Atendimento 24h no WhatsApp",
    saudacaoInicial:
      "Olá! Sou o Atendente Virtual da Nexora 🚀\n\nRespondo clientes no seu WhatsApp 24 horas por dia, tiro dúvidas e fecho agendamentos sozinho. Envie uma mensagem ou clique nas perguntas abaixo para testar ao vivo!",
    sugestoes: [
      "Qual o preço dos planos?",
      "Vocês atendem de madrugada?",
      "Tem horário livre amanhã?",
      "Como conecto meu WhatsApp?",
    ],
  },
};

function horaAtualFormatada(): string {
  const agora = new Date();
  const h = String(agora.getHours()).padStart(2, "0");
  const m = String(agora.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function emitirSom(tipo: "envio" | "resposta") {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (tipo === "envio") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(540, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(820, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.setValueAtTime(1040, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {
    // Silencia se áudio for bloqueado pelo navegador
  }
}

export function DemoAtendente({
  nichoInicial = "barbearia",
}: {
  nichoInicial?: Nicho;
} = {}) {
  const [modo, setModo] = useState<"INTERATIVO" | "CENAS">("INTERATIVO");
  const [nicho, setNicho] = useState<Nicho>(nichoInicial);
  const [somHabilitado, setSomHabilitado] = useState(true);
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [inputTexto, setInputTexto] = useState("");
  const [digitando, setDigitando] = useState(false);
  const [horaStatus, setHoraStatus] = useState("14:30");
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const linkWhatsApp = obterLinkWhatsAppDemo();

  // Estados do modo CENAS (animação passo a passo com jeitos do motor)
  const [cena, setCena] = useState<Cena>("NOITE");
  const [jeito, setJeito] = useState<Jeito>("ACOLHEDOR");
  const [rodada, setRodada] = useState(0);
  const [visiveisCena, setVisiveisCena] = useState(0);
  const [digitandoCena, setDigitandoCena] = useState(false);

  const linhasCena = useMemo(() => linhasDaCena(cena, jeito), [cena, jeito]);

  useEffect(() => {
    setHoraStatus(horaAtualFormatada());
    const interval = setInterval(() => {
      setHoraStatus(horaAtualFormatada());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Reinicia conversa interativa ao trocar de nicho
  useEffect(() => {
    const config = CONFIG_NICHOS[nicho];
    setMensagens([
      {
        id: "msg-0",
        de: "atendente",
        texto: config.saudacaoInicial,
        hora: horaAtualFormatada(),
      },
    ]);
  }, [nicho]);

  // Modo CENAS: animação automática
  useEffect(() => {
    if (modo !== "CENAS") return;
    setVisiveisCena(0);
    setDigitandoCena(false);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisiveisCena(linhasCena.length);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    let quando = 500;
    linhasCena.forEach((linha, i) => {
      if (linha.de === "atendente") {
        timers.push(setTimeout(() => setDigitandoCena(true), quando));
        quando += 1100;
      }
      timers.push(
        setTimeout(() => {
          setDigitandoCena(false);
          setVisiveisCena(i + 1);
        }, quando),
      );
      quando += linha.de === "cliente" ? 800 : 700;
    });
    return () => timers.forEach(clearTimeout);
  }, [linhasCena, rodada, modo]);

  // Scroll automático para a última mensagem
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [mensagens, digitando, visiveisCena, digitandoCena, modo]);

  async function enviarMensagem(textoParaEnviar: string) {
    const textoLimpo = textoParaEnviar.trim();
    if (!textoLimpo || digitando) return;

    setInputTexto("");
    const agora = horaAtualFormatada();
    const idCliente = `msg-c-${Date.now()}`;

    const novaMensagemCliente: MensagemChat = {
      id: idCliente,
      de: "cliente",
      texto: textoLimpo,
      hora: agora,
    };

    const historicoAtualizado = [...mensagens, novaMensagemCliente];
    setMensagens(historicoAtualizado);

    if (somHabilitado) {
      emitirSom("envio");
    }

    setDigitando(true);

    try {
      const res = await fetch("/api/demo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagem: textoLimpo,
          nicho,
          historico: historicoAtualizado.map((m) => ({
            de: m.de,
            texto: m.texto,
          })),
        }),
      });

      const data = await res.json();
      const respostaTexto =
        data.resposta || "Temos horários livres amanhã às 14:00 e às 16:30. Qual desses fica melhor para você?";

      const delay = Math.min(1500, Math.max(900, respostaTexto.length * 15));

      setTimeout(() => {
        setDigitando(false);
        if (somHabilitado) {
          emitirSom("resposta");
        }

        const ehConfirmacao =
          respostaTexto.includes("✅") ||
          respostaTexto.toLowerCase().includes("agendamento confirmado") ||
          respostaTexto.toLowerCase().includes("consulta confirmada");

        const temOpcoesDeHorario =
          respostaTexto.includes("14:00") &&
          respostaTexto.includes("16:30") &&
          !ehConfirmacao;

        setMensagens((prev) => [
          ...prev,
          {
            id: `msg-a-${Date.now()}`,
            de: "atendente",
            texto: respostaTexto,
            hora: horaAtualFormatada(),
            agendamentoConfirmado: ehConfirmacao,
            opcoes: temOpcoesDeHorario
              ? ["Amanhã às 14:00", "Amanhã às 16:30"]
              : undefined,
          },
        ]);
      }, delay);
    } catch {
      setTimeout(() => {
        setDigitando(false);
        if (somHabilitado) emitirSom("resposta");
        setMensagens((prev) => [
          ...prev,
          {
            id: `msg-a-${Date.now()}`,
            de: "atendente",
            texto:
              "Perfeito! O Atendente Virtual da Nexora responde na hora e agenda sem conflitos de horários.",
            hora: horaAtualFormatada(),
          },
        ]);
      }, 1000);
    }
  }

  const configAtual = CONFIG_NICHOS[nicho];
  const terminouCena = visiveisCena >= linhasCena.length && !digitandoCena;

  return (
    <div id="simulador" className="w-full scroll-mt-24">
      {/* SELETOR DE MODO: TESTAR DIGITANDO OU CENAS PRONTAS */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-nx-border bg-nx-surface p-1 text-xs">
          <button
            type="button"
            onClick={() => setModo("INTERATIVO")}
            className={`rounded-lg px-3 py-1.5 font-bold transition-all ${
              modo === "INTERATIVO"
                ? "bg-nx-gold text-nx-bg shadow-nx-glow-sm"
                : "text-nx-secondary hover:text-nx-primary"
            }`}
          >
            💬 Testar digitando
          </button>
          <button
            type="button"
            onClick={() => setModo("CENAS")}
            className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
              modo === "CENAS"
                ? "bg-nx-gold text-nx-bg shadow-nx-glow-sm font-bold"
                : "text-nx-secondary hover:text-nx-primary"
            }`}
          >
            🎬 Cenas prontas
          </button>
        </div>

        {/* NICHOS (NO MODO INTERATIVO) OU CENAS (NO MODO CENAS) */}
        {modo === "INTERATIVO" ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "barbearia", label: "💈 Barbearia" },
                { id: "clinica", label: "💆‍♀️ Clínica" },
                { id: "salao", label: "💇‍♀️ Salão" },
                { id: "geral", label: "🏢 Geral" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setNicho(tab.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  nicho === tab.id
                    ? "bg-nx-gold text-nx-bg shadow-nx-glow-sm"
                    : "border border-nx-border bg-nx-surface text-nx-secondary hover:text-nx-primary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {CENAS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={cena === c.id}
                onClick={() => setCena(c.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  cena === c.id
                    ? "border border-nx-gold/60 bg-nx-gold/15 text-nx-gold"
                    : "border border-nx-border bg-nx-surface text-nx-secondary hover:text-nx-primary"
                }`}
              >
                {c.titulo}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CHIPS DE SUGESTÃO RÁPIDA (MODO INTERATIVO) */}
      {modo === "INTERATIVO" && (
        <div className="mb-4 flex flex-wrap items-center justify-center gap-1.5 px-2">
          {configAtual.sugestoes.map((sugestao) => (
            <button
              key={sugestao}
              type="button"
              onClick={() => enviarMensagem(sugestao)}
              disabled={digitando}
              className="rounded-full border border-nx-border/80 bg-nx-surface/90 px-3 py-1 text-[11px] font-medium text-nx-secondary shadow-sm transition-all hover:border-nx-gold/50 hover:bg-nx-surface-2 hover:text-nx-gold disabled:opacity-50"
            >
              &quot;{sugestao}&quot;
            </button>
          ))}
        </div>
      )}

      {/* DISPOSITIVO SMARTPHONE ULTRA-REALISTA */}
      <div className="mx-auto max-w-[410px] rounded-[3rem] border border-nx-border-2 bg-gradient-to-b from-[#2A2E3D] via-[#1A1D27] to-[#0E1017] p-3 shadow-2xl ring-1 ring-white/10">
        <div className="relative flex h-[580px] sm:h-[620px] flex-col overflow-hidden rounded-[2.35rem] bg-[#0B141A] border border-[#1E222D]">
          {/* BARRA DE STATUS DO TELEFONE (HORA, WI-FI, BATERIA) */}
          <div className="flex h-7 items-center justify-between px-6 pt-1 text-[11px] font-semibold text-white/80 select-none bg-[#202C33]">
            <span>{horaStatus}</span>
            <div className="h-4 w-20 rounded-full bg-black/80 flex items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-black ring-1 ring-white/10" />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span>5G</span>
              <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 21l3.39-.62C9.27 20.74 10.6 21 12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z" />
              </svg>
              <span>96%</span>
            </div>
          </div>

          {/* CABEÇALHO DO WHATSAPP */}
          <div className="flex items-center justify-between border-b border-[#2A3942]/50 bg-[#202C33] px-3 py-2.5 shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                className="text-[#A7B2B8] hover:text-white transition-colors"
                title="Voltar"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="relative shrink-0">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-white shadow-inner ${
                    modo === "CENAS" ? "bg-[#1E293B]" : configAtual.corAvatar
                  }`}
                >
                  {modo === "CENAS" ? "💈" : configAtual.avatarLetra}
                </div>
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#202C33] bg-[#25D366]" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#E9EDEF]">
                  {modo === "CENAS" ? EMPRESA_EXEMPLO : configAtual.nomeEmpresa}
                </p>
                <p className="flex items-center gap-1.5 text-[11px] leading-none">
                  {digitando || digitandoCena ? (
                    <span className="font-semibold text-[#25D366] animate-pulse">
                      digitando…
                    </span>
                  ) : (
                    <span className="text-[#8696A0]">online agora</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[#A7B2B8]">
              {/* TOGGLE DE SOM */}
              <button
                type="button"
                onClick={() => setSomHabilitado(!somHabilitado)}
                className={`rounded-full p-1 transition-colors ${
                  somHabilitado ? "text-[#25D366] hover:bg-white/10" : "text-[#8696A0] hover:bg-white/10"
                }`}
                title={somHabilitado ? "Som ativado" : "Som silenciado"}
              >
                {somHabilitado ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                )}
              </button>

              <span className="rounded-full border border-[#2A3942] bg-[#182229] px-2 py-0.5 text-[10px] font-semibold text-[#8696A0]">
                {modo === "CENAS" ? "Exemplo" : "Ao vivo"}
              </span>
            </div>
          </div>

          {/* ÁREA DE CONVERSA COM FUNDO DO WHATSAPP */}
          <div
            ref={chatScrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-3.5 py-4 scroll-smooth"
            style={{
              backgroundImage:
                "radial-gradient(#182229 0.75px, transparent 0.75px), radial-gradient(#182229 0.75px, #0B141A 0.75px)",
              backgroundSize: "30px 30px",
              backgroundPosition: "0 0, 15px 15px",
            }}
          >
            <div className="flex justify-center">
              <span className="rounded-lg bg-[#182229] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8696A0] shadow-sm">
                HOJE
              </span>
            </div>

            <div className="mx-auto max-w-[280px] rounded-lg bg-[#182229]/90 px-3 py-1.5 text-center text-[10px] leading-tight text-[#FFD279] shadow-sm">
              🔒 As mensagens são protegidas e enviadas em tempo real como no WhatsApp oficial.
            </div>

            {modo === "INTERATIVO" ? (
              <>
                {mensagens.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.de === "cliente" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`relative max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-md ${
                        msg.de === "cliente"
                          ? "rounded-tr-xs bg-[#005C4B] text-[#E9EDEF]"
                          : "rounded-tl-xs bg-[#202C33] text-[#E9EDEF]"
                      }`}
                    >
                      <p className="whitespace-pre-line">{msg.texto}</p>

                      {msg.opcoes && (
                        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-2.5">
                          {msg.opcoes.map((opcao) => (
                            <button
                              key={opcao}
                              type="button"
                              onClick={() => enviarMensagem(`Quero confirmar ${opcao}`)}
                              className="rounded-lg bg-[#00A884] px-2.5 py-1 text-xs font-bold text-white shadow-sm transition-transform active:scale-95 hover:bg-[#00A884]/90"
                            >
                              📅 {opcao}
                            </button>
                          ))}
                        </div>
                      )}

                      {msg.agendamentoConfirmado && (
                        <div className="mt-2.5 rounded-xl border border-[#25D366]/40 bg-[#0B141A]/60 p-2.5 text-xs text-[#E9EDEF]">
                          <div className="flex items-center gap-1.5 font-bold text-[#25D366]">
                            <span>✓</span> Agendamento salvo na agenda Nexora
                          </div>
                          <p className="mt-1 text-[11px] text-[#8696A0]">
                            Cliente recebe link do agendamento e lembrete anti-falta automático 2h antes.
                          </p>
                        </div>
                      )}

                      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#8696A0]">
                        <span>{msg.hora}</span>
                        {msg.de === "cliente" && (
                          <span className="font-bold text-[#53BDEB]" title="Lido">
                            ✓✓
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

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
              </>
            ) : (
              <>
                {linhasCena.slice(0, visiveisCena).map((linha, i) =>
                  linha.de === "aviso" ? (
                    <p key={i} className="mx-auto w-fit rounded-full bg-[#182229] px-3 py-1 text-center text-[11px] text-[#8696A0]">
                      {linha.texto}
                    </p>
                  ) : (
                    <div key={i} className={`flex flex-col ${linha.de === "cliente" ? "items-end" : "items-start"}`}>
                      <div
                        className={`relative max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-md ${
                          linha.de === "cliente"
                            ? "rounded-tr-xs bg-[#005C4B] text-[#E9EDEF]"
                            : "rounded-tl-xs bg-[#202C33] text-[#E9EDEF]"
                        }`}
                      >
                        <p className="whitespace-pre-line">{linha.texto}</p>
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#8696A0]">
                          <span>{horaStatus}</span>
                          {linha.de === "cliente" && <span className="font-bold text-[#53BDEB]">✓✓</span>}
                        </div>
                      </div>
                    </div>
                  ),
                )}
                {digitandoCena && (
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
              </>
            )}
          </div>

          {/* BARRA INFERIOR DE DIGITAÇÃO OU CONTROLES DE CENA */}
          {modo === "INTERATIVO" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviarMensagem(inputTexto);
              }}
              className="flex items-center gap-2 border-t border-[#2A3942]/40 bg-[#202C33] p-2.5"
            >
              <div className="flex items-center gap-1 text-[#8696A0]">
                <span className="cursor-pointer p-1 text-base hover:text-white" title="Emoji">
                  😀
                </span>
                <span className="cursor-pointer p-1 text-base hover:text-white" title="Anexo">
                  📎
                </span>
              </div>

              <input
                type="text"
                value={inputTexto}
                onChange={(e) => setInputTexto(e.target.value)}
                placeholder="Digite uma mensagem..."
                disabled={digitando}
                className="flex-1 rounded-2xl bg-[#2A3942] px-3.5 py-2 text-xs text-[#E9EDEF] placeholder-[#8696A0] outline-none focus:ring-1 focus:ring-[#00A884]"
              />

              {inputTexto.trim().length > 0 ? (
                <button
                  type="submit"
                  disabled={digitando}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00A884] text-white shadow-md transition-transform hover:scale-105 active:scale-95"
                  title="Enviar mensagem"
                >
                  <svg className="h-4 w-4 rotate-45" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              ) : (
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2A3942] text-[#8696A0]"
                  title="Microfone"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                </div>
              )}
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#2A3942]/40 bg-[#202C33] px-3 py-2.5">
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
                disabled={!terminouCena}
                className="text-[11px] font-semibold text-nx-gold transition-opacity hover:underline disabled:opacity-40"
              >
                Ver de novo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CALL TO ACTION LOGO ABAIXO DO SIMULADOR */}
      <div className="mx-auto mt-6 max-w-md rounded-2xl border border-nx-border bg-nx-surface p-5 text-center shadow-nx-panel">
        <p className="text-xs font-semibold text-nx-gold uppercase tracking-wider">
          ✦ Experimentou a agilidade?
        </p>
        <p className="mt-1 text-sm font-bold text-nx-primary">
          Tenha esse mesmo atendente no WhatsApp da sua empresa
        </p>
        <p className="mt-1 text-xs text-nx-secondary">
          Ele atende de dia, noite e finais de semana sem deixar nenhum cliente sem resposta.
        </p>
        <Link
          href="/cadastro"
          className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-nx-gold px-5 py-3 text-sm font-bold text-nx-bg shadow-nx-glow-sm transition-all hover:bg-nx-gold/90 hover:scale-[1.01] active:scale-[0.98]"
        >
          ✦ Começar teste grátis de 7 dias (Sem cartão) →
        </Link>
        <p className="mt-2 text-[11px] text-nx-muted">
          Ou se preferir,{" "}
          <a
            href={linkWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            className="text-nx-secondary underline hover:text-nx-primary"
          >
            testar no WhatsApp de Teste
          </a>
          .
        </p>
      </div>

      <div className="mt-2 text-center text-[10px] text-nx-muted">
        <span>Testar digitando • Simulação em tempo real via /api/demo/chat</span>
      </div>
    </div>
  );
}
