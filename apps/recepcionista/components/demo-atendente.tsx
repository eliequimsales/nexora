"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { trackCustom } from "@/lib/analytics/pixel";
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
 * SIMULADOR IMERSIVO DO ATENDENTE NO WHATSAPP
 *
 * Imersão total e zero atrito na landing page:
 * - Apenas o smartphone centralizado, sem configurações cansativas
 * - Nicho padrão: Clínica Estética (Sofia ✨)
 * - Exclusivo por seleção de mensagens reais do cliente (sem digitação livre)
 * - Mensagens selecionáveis têm o visual exato da mensagem que o cliente vai enviar
 * - Sem botões artificiais de reiniciar
 * - Áudio realista de envio e resposta (Web Audio API nativa)
 */

type Nicho = "barbearia" | "clinica" | "salao" | "geral";
type LinhaCena = Bolha | { de: "aviso"; texto: string };
type Cena = "NOITE" | "DOMINGO" | "LOJA_CHEIA";

interface OpcaoPergunta {
  id: string;
  rotulo: string;
  mensagem: string;
  resposta: string;
  agendamentoConfirmado?: boolean;
  proximasOpcoes?: OpcaoPergunta[];
}

interface MensagemChat {
  id: string;
  de: "cliente" | "atendente";
  texto: string;
  hora: string;
  opcoes?: OpcaoPergunta[];
  agendamentoConfirmado?: boolean;
}

const EMPRESA_EXEMPLO = "Clínica Renove Estética";
const NOME_EXEMPLO = "Sofia";

const HORARIO_DE_EXEMPLO = horarioFalado([
  { day: 0, open: "09:00", close: "19:00", closed: true },
  ...[1, 2, 3, 4, 5].map((day) => ({ day, open: "09:00", close: "19:00", closed: false })),
  { day: 6, open: "09:00", close: "15:00", closed: false },
]);

// Cenas de exemplo do motor (compatibilidade e testes de esteira)
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
      servico: "Avaliação",
      detalhe: "Gratuita, 30 min",
      opcoes: ["1 · amanhã, 10h30 com Dra. Camila", "2 · amanhã, 15h com Dra. Camila"],
      escolhida: { quando: "Amanhã, às 15h", profissional: "Dra. Camila" },
      volta: "amanhã às 10h",
      cumprimento: "Boa noite",
    });
  }

  if (cena === "DOMINGO") {
    return [
      { de: "cliente", texto: "Bom dia! Quanto custa a limpeza de pele?" },
      {
        de: "atendente",
        texto: `${t.saudacao({ cumprimento: "Bom dia", cliente: "Carla", apresentacao: ap })} ${t.contextoFechado("segunda às 9h")}`,
      },
      { de: "atendente", texto: `${t.preco({ servico: "Limpeza de Pele", preco: "R$ 140,00", duracao: "50 min" })} ${t.convite}` },
      { de: "cliente", texto: "Quero! Uma limpeza segunda de manhã" },
      {
        de: "atendente",
        texto: [
          t.ofertaLead({ servico: "Limpeza de Pele", detalhe: "R$ 140,00, 50 min", quando: "segunda" }),
          "1 · seg, 10h30 com Dra. Camila",
          "2 · seg, 14h com Dra. Camila",
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

const PERGUNTAS_POR_NICHO: Record<Nicho, OpcaoPergunta[]> = {
  clinica: [
    {
      id: "clin-horario",
      rotulo: "Ver horários livres",
      mensagem: "Boa tarde! Vocês têm horário livre para amanhã de tarde?",
      resposta:
        "Olá! Bem-vinda à Clínica Renove Estética ✨ Temos vagas para avaliação estética amanhã às 10:30 e às 15:00 com a Dra. Camila. Qual horário você prefere?",
      proximasOpcoes: [
        {
          id: "clin-horario-15",
          rotulo: "Pode ser às 15:00",
          mensagem: "Pode ser às 15:00, por favor!",
          resposta:
            "Perfeito! Consulta agendada para amanhã às 15:00 com a Dra. Camila. Salvei na agenda da clínica! ✅",
          agendamentoConfirmado: true,
          proximasOpcoes: [
            {
              id: "clin-pos-lembrete",
              rotulo: "Como funciona o lembrete",
              mensagem: "Vocês mandam confirmação antes da consulta?",
              resposta:
                "Sim! Nosso sistema envia um lembrete no WhatsApp 2h antes para confirmar a presença. ✅",
            },
          ],
        },
        {
          id: "clin-horario-1030",
          rotulo: "Prefiro às 10:30",
          mensagem: "Prefiro às 10:30 da manhã, por favor!",
          resposta:
            "Excelente! Agendado para amanhã às 10:30 com a Dra. Camila. Te esperamos na clínica! ✅",
          agendamentoConfirmado: true,
        },
      ],
    },
    {
      id: "clin-24h",
      rotulo: "Atendimento fora do horário",
      mensagem: "Vocês atendem e marcam consultas aos finais de semana?",
      resposta:
        "Sim! Eu fico ativa 24 horas por dia no WhatsApp. Se uma paciente mandar mensagem às 23h de domingo, ela já acorda na segunda com a consulta marcada!",
      proximasOpcoes: [
        {
          id: "clin-24h-agendar",
          rotulo: "Ver horários livres",
          mensagem: "Tem horário livre para amanhã de tarde?",
          resposta:
            "Temos às 10:30 e às 15:00 com a Dra. Camila. Qual horário você prefere?",
        },
      ],
    },
    {
      id: "clin-lembrete",
      rotulo: "Lembrete anti-falta",
      mensagem: "Como funciona a confirmação automática de presença?",
      resposta:
        "O sistema envia um lembrete no WhatsApp 2h antes com confirmação de presença em 1 toque. Reduz faltas em até 80% e mantém suas salas sempre cheias!",
      proximasOpcoes: [
        {
          id: "clin-lembrete-teste",
          rotulo: "Agendar consulta teste",
          mensagem: "Quero agendar uma consulta para amanhã às 15:00!",
          resposta:
            "Perfeito! Consulta agendada para amanhã às 15:00 com a Dra. Camila. Lembrete anti-falta ativado! ✅",
          agendamentoConfirmado: true,
        },
      ],
    },
  ],
  barbearia: [
    {
      id: "barb-horario",
      rotulo: "Ver horários livres",
      mensagem: "Boa noite! Vocês têm horário livre para amanhã de tarde?",
      resposta:
        "Olá! Sou a Bia, atendente virtual da Barbearia do Léo 💈 Temos sim! Às 14:30 e às 16:00 com o Léo. Qual desses horários fica melhor para você?",
      proximasOpcoes: [
        {
          id: "barb-horario-16",
          rotulo: "Pode ser às 16:00",
          mensagem: "Pode ser às 16:00, por favor!",
          resposta:
            "Perfeito! Agendado para amanhã às 16:00 com o Léo. Salvei na agenda. Tenha uma ótima noite! ✅",
          agendamentoConfirmado: true,
        },
        {
          id: "barb-horario-1430",
          rotulo: "Prefiro às 14:30",
          mensagem: "Prefiro às 14:30, por favor!",
          resposta:
            "Perfeito! Horário confirmado para amanhã às 14:30 com o Léo. Salvei na agenda! ✅",
          agendamentoConfirmado: true,
        },
      ],
    },
    {
      id: "barb-preco",
      rotulo: "Consultar preços",
      mensagem: "Boa noite! Quanto custa o corte e barba?",
      resposta:
        "Nosso Corte Degradê sai por R$ 45,00 e a Barba na toalha quente por R$ 35,00 (ou o combo por R$ 70,00). Deseja agendar um horário para amanhã?",
    },
    {
      id: "barb-24h",
      rotulo: "Atendimento 24h",
      mensagem: "Vocês atendem de madrugada ou no fim de semana?",
      resposta:
        "Sim! O Atendente Virtual da Nexora fica de plantão 24/7 no seu WhatsApp. Quando você dorme ou está atendendo, ele responde os clientes em 10 segundos e fecha agendamentos.",
    },
    {
      id: "barb-lembrete",
      rotulo: "Lembrete anti-falta",
      mensagem: "Como funciona o lembrete anti-falta da agenda?",
      resposta:
        "O lembrete anti-falta envia uma confirmação automática no WhatsApp do cliente 2h antes. Se ele confirmar, você tem certeza da presença; se desmarcar, o horário é liberado na hora para outro!",
    },
  ],
  salao: [
    {
      id: "sal-horario",
      rotulo: "Vaga para escova",
      mensagem: "Olá! Tem horário amanhã para escova modelada?",
      resposta:
        "Olá! Sou a Camila do Studio Bella Hair 💇‍♀️ Temos vaga amanhã às 11:00 e às 16:30 com a Jéssica. Qual você prefere?",
      proximasOpcoes: [
        {
          id: "sal-horario-1630",
          rotulo: "Pode marcar às 16:30",
          mensagem: "Pode marcar às 16:30, por favor!",
          resposta:
            "Agendamento confirmado para amanhã às 16:30 com a Jéssica! Salvei na agenda. Te esperamos! ✅",
          agendamentoConfirmado: true,
        },
      ],
    },
    {
      id: "sal-preco",
      rotulo: "Tabela de preços",
      mensagem: "Quanto custa o pé e mão e a escova?",
      resposta:
        "Nossa Escova Modelada sai por R$ 60,00 e Manicure + Pedicure por R$ 55,00. Quer reservar um horário?",
    },
    {
      id: "sal-24h",
      rotulo: "Atendimento à noite",
      mensagem: "Consigo agendar de madrugada ou domingo?",
      resposta:
        "Com certeza! A Camila atende no WhatsApp do salão dia e noite. Suas clientes mandam mensagem na hora que têm tempo e o salão nunca perde vendas.",
    },
    {
      id: "sal-lembrete",
      rotulo: "Lembrete para clientes",
      mensagem: "Como o salão evita clientes que esquecem o horário?",
      resposta:
        "O atendente dispara uma confirmação automática 2h antes pelo WhatsApp. A cliente confirma com 1 toque e seu salão não perde o horário vago!",
    },
  ],
  geral: [
    {
      id: "geral-preco",
      rotulo: "Preço dos planos",
      mensagem: "Qual o valor da mensalidade e dos planos da Nexora?",
      resposta:
        "O plano Nexora Atendente custa R$ 97,00/mês e o Nexora Completo R$ 197,00/mês. A primeira semana é 100% grátis e sem cartão de crédito!",
    },
    {
      id: "geral-24h",
      rotulo: "Plantão 24h",
      mensagem: "O atendente realmente responde de madrugada e no domingo?",
      resposta:
        "Exatamente! Ele roda na nuvem 24 horas por dia, 7 dias por semana. Não precisa de computador nem celular ligado. Responde em menos de 10 segundos no seu próprio WhatsApp comercial.",
    },
    {
      id: "geral-agenda",
      rotulo: "Agendamento automático",
      mensagem: "Como o atendente fecha agendamento direto na agenda?",
      resposta:
        "Ele mostra os horários livres para o cliente no WhatsApp, fecha a reserva na hora e envia um lembrete anti-falta 2 horas antes.",
    },
    {
      id: "geral-garantia",
      rotulo: "Garantia de 30 dias",
      mensagem: "E se eu não gostar ou achar que não valeu a pena?",
      resposta:
        "Você tem 30 dias de Garantia de Satisfação integral. Se você achar que o Atendente não valeu a pena para a sua empresa, nós devolvemos 100% do que você pagou. Sem perguntas nem burocracia.",
    },
  ],
};

const CONFIG_NICHOS: Record<
  Nicho,
  {
    nomeEmpresa: string;
    nomeAtendente: string;
    avatarLetra: string;
    corAvatar: string;
    subtitulo: string;
    saudacaoInicial: string;
  }
> = {
  clinica: {
    nomeEmpresa: "Clínica Renove Estética",
    nomeAtendente: "Sofia",
    avatarLetra: "✨",
    corAvatar: "bg-[#334155]",
    subtitulo: "Procedimentos e Estética Avançada",
    saudacaoInicial:
      "Olá! Bem-vinda à Clínica Renove Estética ✨ Sou a Sofia, assistente virtual da clínica.\n\nComo posso te ajudar hoje?",
  },
  barbearia: {
    nomeEmpresa: "Barbearia do Léo",
    nomeAtendente: "Bia",
    avatarLetra: "💈",
    corAvatar: "bg-[#1E293B]",
    subtitulo: "Cortes, Barba e Pigmentação",
    saudacaoInicial:
      "Olá! Sou a Bia, atendente virtual da Barbearia do Léo 💈\n\nComo posso te ajudar hoje?",
  },
  salao: {
    nomeEmpresa: "Studio Bella Hair",
    nomeAtendente: "Camila",
    avatarLetra: "💇‍♀️",
    corAvatar: "bg-[#3B1F2B]",
    subtitulo: "Cabelos, Unhas e Make",
    saudacaoInicial:
      "Olá! Sou a Camila do Studio Bella Hair 💇‍♀️\n\nComo posso te ajudar hoje?",
  },
  geral: {
    nomeEmpresa: "Nexora · Atendente Virtual",
    nomeAtendente: "Bia",
    avatarLetra: "✦",
    corAvatar: "bg-nx-gold",
    subtitulo: "Atendimento 24h no WhatsApp",
    saudacaoInicial:
      "Olá! Sou o Atendente Virtual da Nexora 🚀\n\nRespondo clientes no seu WhatsApp 24 horas por dia, tiro dúvidas e fecho agendamentos sozinho.",
  },
};

function horaAtualFormatada(): string {
  const agora = new Date();
  const h = String(agora.getHours()).padStart(2, "0");
  const m = String(agora.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function emitirSom(_tipo: "envio" | "resposta") {
  // Áudio desativado: sem sons ou locutor
}

export function DemoAtendente({
  nichoInicial = "clinica",
}: {
  nichoInicial?: Nicho;
} = {}) {
  // Nicho padrão definido como clínica por solicitação
  const nicho = nichoInicial;
  const [somHabilitado, setSomHabilitado] = useState(true);
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [opcoesAtivas, setOpcoesAtivas] = useState<OpcaoPergunta[]>([]);
  const [digitando, setDigitando] = useState(false);
  const [horaStatus, setHoraStatus] = useState("14:30");
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHoraStatus(horaAtualFormatada());
    const interval = setInterval(() => {
      setHoraStatus(horaAtualFormatada());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Inicializa a conversa com as mensagens da clínica
  useEffect(() => {
    const config = CONFIG_NICHOS[nicho];
    const iniciais = PERGUNTAS_POR_NICHO[nicho];
    setOpcoesAtivas(iniciais);
    setMensagens([
      {
        id: "msg-0",
        de: "atendente",
        texto: config.saudacaoInicial,
        hora: horaAtualFormatada(),
        opcoes: iniciais,
      },
    ]);
  }, [nicho]);

  // Scroll automático para a última mensagem
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [mensagens, digitando, opcoesAtivas]);

  // EXCLUSIVO POR SELEÇÃO: o simulador responde a mensagem real do cliente
  function selecionarPergunta(opcao: OpcaoPergunta) {
    if (digitando) return;

    const agora = horaAtualFormatada();
    const idCliente = `msg-c-${Date.now()}`;

    const novaMensagemCliente: MensagemChat = {
      id: idCliente,
      de: "cliente",
      texto: opcao.mensagem,
      hora: agora,
    };

    setMensagens((prev) => [...prev, novaMensagemCliente]);

    if (somHabilitado) {
      emitirSom("envio");
    }

    setDigitando(true);

    // Opcional: telemetria /api/demo/chat
    fetch("/api/demo/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: opcao.mensagem, nicho }),
    }).catch(() => {});

    try {
      trackCustom("InteractedWithDemo", { question: opcao.mensagem, nicho });
    } catch {}

    const delay = Math.min(1200, Math.max(750, opcao.resposta.length * 8));

    setTimeout(() => {
      setDigitando(false);
      if (somHabilitado) {
        emitirSom("resposta");
      }

      const proximas =
        opcao.proximasOpcoes && opcao.proximasOpcoes.length > 0
          ? opcao.proximasOpcoes
          : PERGUNTAS_POR_NICHO[nicho].filter((p) => p.id !== opcao.id);

      setOpcoesAtivas(proximas);

      setMensagens((prev) => [
        ...prev,
        {
          id: `msg-a-${Date.now()}`,
          de: "atendente",
          texto: opcao.resposta,
          hora: horaAtualFormatada(),
          agendamentoConfirmado: opcao.agendamentoConfirmado,
          opcoes: proximas,
        },
      ]);
    }, delay);
  }

  const configAtual = CONFIG_NICHOS[nicho];

  return (
    <div id="simulador" className="w-full scroll-mt-24">
      {/* DISPOSITIVO SMARTPHONE ULTRA-REALISTA CENTRALIZADO (SEM CONTROLES EXTERNOS) */}
      <div className="mx-auto max-w-[420px] rounded-[3rem] border border-nx-border-2 bg-gradient-to-b from-[#2A2E3D] via-[#1A1D27] to-[#0E1017] p-3 shadow-2xl ring-1 ring-white/10">
        <div className="relative flex h-[580px] sm:h-[620px] flex-col overflow-hidden rounded-[2.35rem] bg-[#0B141A] border border-[#1E222D]">
          {/* BARRA DE STATUS DO TELEFONE (HORA, DYNAMIC ISLAND, BATERIA) */}
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
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-white shadow-inner ${configAtual.corAvatar}`}
                >
                  {configAtual.avatarLetra}
                </div>
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#202C33] bg-[#25D366]" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#E9EDEF]">
                  {configAtual.nomeEmpresa}
                </p>
                <p className="flex items-center gap-1.5 text-[11px] leading-none">
                  {digitando ? (
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                )}
              </button>

              <span className="rounded-full border border-[#2A3942] bg-[#182229] px-2 py-0.5 text-[10px] font-semibold text-[#8696A0]">
                Ao vivo
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

            <div className="mx-auto max-w-[290px] rounded-lg bg-[#182229]/90 px-3 py-1.5 text-center text-[10px] leading-tight text-[#FFD279] shadow-sm">
              🔒 As mensagens são protegidas e enviadas em tempo real como no WhatsApp oficial.
            </div>

            {mensagens.map((msg, indexMsg) => {
              const ehUltimaAtendente =
                msg.de === "atendente" && indexMsg === mensagens.length - 1;
              return (
                <div key={msg.id} className="space-y-2">
                  <div
                    className={`flex flex-col ${msg.de === "cliente" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`relative max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-md ${
                        msg.de === "cliente"
                          ? "rounded-tr-xs bg-[#005C4B] text-[#E9EDEF]"
                          : "rounded-tl-xs bg-[#202C33] text-[#E9EDEF]"
                      }`}
                    >
                      <p className="whitespace-pre-line">{msg.texto}</p>

                      {/* SELO DE CONFIRMAÇÃO DE AGENDAMENTO AUTOMÁTICO */}
                      {msg.agendamentoConfirmado && (
                        <div className="mt-2.5 rounded-xl border border-[#25D366]/40 bg-[#0B141A]/70 p-2.5 text-xs text-[#E9EDEF]">
                          <div className="flex items-center gap-1.5 font-bold text-[#25D366]">
                            <span>✓</span> Horário reservado automaticamente
                          </div>
                          <p className="mt-1 text-[11px] text-[#8696A0]">
                            Você acorda com a agenda preenchida. Cliente recebe link de confirmação e lembrete anti-falta.
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

                  {/* OPÇÕES COM O TEXTO REAL DA MENSAGEM DO CLIENTE (ALINHADAS À DIREITA) */}
                  {ehUltimaAtendente && msg.opcoes && msg.opcoes.length > 0 && !digitando && (
                    <div className="flex flex-col items-end gap-2 pt-1">
                      {msg.opcoes.map((opcao) => (
                        <button
                          key={opcao.id}
                          type="button"
                          onClick={() => selecionarPergunta(opcao)}
                          disabled={digitando}
                          className="group relative max-w-[88%] rounded-2xl rounded-tr-xs border border-[#00A884]/60 bg-[#005C4B]/25 px-3.5 py-2.5 text-left text-[13px] leading-relaxed text-[#E9EDEF] shadow-md transition-all hover:bg-[#005C4B]/60 hover:border-[#00A884] hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
                        >
                          <p className="text-[13px] leading-snug">{opcao.mensagem}</p>
                          <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] font-semibold text-[#25D366] opacity-80 group-hover:opacity-100">
                            <span>Toque para enviar</span>
                            <span aria-hidden="true">→</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
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

          {/* BARRA INFERIOR COM VISUAL AUTÊNTICO DO WHATSAPP (SEM BOTÃO REINICIAR) */}
          <div className="flex items-center gap-2 border-t border-[#2A3942]/50 bg-[#202C33] px-3 py-2.5">
            <span className="text-lg text-[#8696A0] select-none" aria-hidden="true">
              😀
            </span>
            <div className="flex flex-1 items-center rounded-2xl bg-[#2A3942] px-3.5 py-2 text-xs text-[#8696A0] select-none">
              <span className="truncate">Toque em uma mensagem acima para enviar...</span>
            </div>
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00A884] text-white shadow-sm"
              title="Microfone"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </div>
          </div>
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
          onClick={() => {
            try {
              trackCustom("ClickSignupCTA", { cta_location: "simulador_whatsapp" });
            } catch {}
          }}
          className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-nx-gold px-5 py-3 text-sm font-bold text-nx-bg shadow-nx-glow-sm transition-all hover:bg-nx-gold/90 hover:scale-[1.01] active:scale-[0.98]"
        >
          ✦ Quero esse Atendente no meu WhatsApp agora →
        </Link>
      </div>

      <div className="mt-2 text-center text-[10px] text-nx-muted">
        <span>Simulação interativa • Atendente 24h e agendamento automático</span>
      </div>
    </div>
  );
}
