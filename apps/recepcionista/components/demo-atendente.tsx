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
 * - Barra superior do WhatsApp com avatar, online/digitando… e ações
 * - Balões de mensagem realistas com pontas (tail), carimbo de hora e tique duplo azul (✓✓)
 * - Efeitos sonoros sutis de envio e recebimento de mensagem (Web Audio API nativa)
 * - Modo Interativo: exclusivo por seleção de mensagens (impossível digitar mensagens aleatórias)
 * - Modo Cenas prontas: reproduz 22h pedindo horário, domingo e loja cheia com os jeitos do motor
 * - Seletor de nicho: Barbearia, Clínica, Salão, Geral
 * - Confirmação de agendamento rica com selo de reserva na agenda
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

const PERGUNTAS_POR_NICHO: Record<Nicho, OpcaoPergunta[]> = {
  barbearia: [
    {
      id: "barb-horario",
      rotulo: "📅 Ver horários de amanhã",
      mensagem: "Boa noite! Vocês têm horário livre para amanhã de tarde?",
      resposta:
        "Olá! Sou a Bia, atendente virtual da Barbearia do Léo 💈 Temos horários livres sim! Às 14:30 e às 16:00 com o Léo. Qual desses horários fica melhor para você?",
      proximasOpcoes: [
        {
          id: "barb-horario-16",
          rotulo: "📅 Pode ser às 16:00, por favor!",
          mensagem: "Pode ser às 16:00, por favor!",
          resposta:
            "Perfeito! Agendado para amanhã às 16:00 com o Léo. Salvei na agenda. Tenha uma ótima noite! ✅",
          agendamentoConfirmado: true,
          proximasOpcoes: [
            {
              id: "barb-preco-pos",
              rotulo: "💰 Quanto custa o corte e barba?",
              mensagem: "Quanto custa o corte e barba?",
              resposta:
                "Nosso Corte Degradê é R$ 45,00 e a Barba na toalha quente é R$ 35,00 (ou o combo por R$ 70,00).",
            },
            {
              id: "barb-lembrete-pos",
              rotulo: "🔔 Vocês mandam lembrete?",
              mensagem: "Vocês mandam lembrete antes do horário?",
              resposta:
                "Sim! Nosso lembrete anti-falta envia uma confirmação no seu WhatsApp 2h antes para você não esquecer. ✅",
            },
          ],
        },
        {
          id: "barb-horario-1430",
          rotulo: "📅 Prefiro às 14:30!",
          mensagem: "Prefiro às 14:30, por favor!",
          resposta:
            "Perfeito! Horário confirmado para amanhã às 14:30 com o Léo. Salvei na agenda da barbearia! ✅",
          agendamentoConfirmado: true,
        },
        {
          id: "barb-sabado",
          rotulo: "💬 Tem vaga no sábado?",
          mensagem: "Vocês atendem no sábado de manhã?",
          resposta:
            "No sábado abrimos das 09:00 às 14:00! Temos horário livre às 10:00 e às 11:30. Deseja garantir uma dessas?",
        },
      ],
    },
    {
      id: "barb-preco",
      rotulo: "💰 Consultar preços de serviços",
      mensagem: "Boa noite! Quanto custa o corte e barba?",
      resposta:
        "Nosso Corte Degradê sai por R$ 45,00 e a Barba na toalha quente por R$ 35,00 (ou o combo completo por R$ 70,00). Deseja agendar um horário para amanhã?",
      proximasOpcoes: [
        {
          id: "barb-preco-agendar",
          rotulo: "📅 Sim, quero agendar para amanhã!",
          mensagem: "Quero agendar para amanhã às 14h, por favor!",
          resposta:
            "Perfeito! Agendado para amanhã às 14:00 com o Léo. Salvei na agenda. Tenha uma ótima noite! ✅",
          agendamentoConfirmado: true,
        },
        {
          id: "barb-preco-24h",
          rotulo: "🌙 Vocês atendem de madrugada?",
          mensagem: "Vocês atendem de madrugada ou no domingo?",
          resposta:
            "Sim! O Atendente Virtual fica ativo 24h por dia. Mesmo com a barbearia fechada, ele responde no WhatsApp na hora e marca clientes para o dia seguinte.",
        },
      ],
    },
    {
      id: "barb-24h",
      rotulo: "🌙 Atendimento 24h e finais de semana",
      mensagem: "Vocês atendem de madrugada ou no fim de semana?",
      resposta:
        "Sim! O Atendente Virtual da Nexora fica de plantão 24/7 no seu WhatsApp. Quando você dorme ou está cortando cabelo, ele responde os clientes em 10 segundos e fecha os agendamentos.",
      proximasOpcoes: [
        {
          id: "barb-24h-horario",
          rotulo: "📅 Ver horários de amanhã",
          mensagem: "Vocês têm horário livre para amanhã de tarde?",
          resposta: "Temos sim! Às 14:30 e às 16:00 com o Léo. Qual horário fica melhor para você?",
        },
        {
          id: "barb-24h-preco",
          rotulo: "💰 Consultar tabela de preços",
          mensagem: "Qual o valor do corte e barba?",
          resposta: "Corte Degradê R$ 45,00 e Barba R$ 35,00 (combo R$ 70,00).",
        },
      ],
    },
    {
      id: "barb-lembrete",
      rotulo: "🔔 Como funciona o lembrete anti-falta?",
      mensagem: "Como funciona o lembrete anti-falta da agenda?",
      resposta:
        "O lembrete anti-falta envia uma mensagem carinhosa e automática no WhatsApp do cliente 2h antes. Se ele confirmar, você tem certeza da presença; se desmarcar, o horário é liberado imediatamente para outro!",
      proximasOpcoes: [
        {
          id: "barb-lembrete-agendar",
          rotulo: "📅 Testar agendamento de horário",
          mensagem: "Quero agendar amanhã às 16:00!",
          resposta:
            "Agendamento confirmado para amanhã às 16:00! Salvei na agenda e ativei o lembrete anti-falta. ✅",
          agendamentoConfirmado: true,
        },
      ],
    },
  ],
  clinica: [
    {
      id: "clin-horario",
      rotulo: "📅 Horários de consulta estética",
      mensagem: "Boa tarde! Vocês têm horário livre amanhã com a especialista?",
      resposta:
        "Olá! Bem-vinda à Clínica Renove Estética ✨ Temos vagas para avaliação estética amanhã às 10:30 e às 15:00 com a Dra. Camila. Qual horário você prefere?",
      proximasOpcoes: [
        {
          id: "clin-horario-15",
          rotulo: "📅 Pode ser às 15:00, por favor!",
          mensagem: "Pode ser às 15:00, por favor!",
          resposta:
            "Perfeito! Consulta agendada para amanhã às 15:00 com a Dra. Camila. Salvei na agenda da clínica! ✅",
          agendamentoConfirmado: true,
        },
        {
          id: "clin-horario-1030",
          rotulo: "📅 Prefiro às 10:30 da manhã!",
          mensagem: "Prefiro às 10:30, por favor!",
          resposta:
            "Excelente! Agendado para amanhã às 10:30 com a Dra. Camila. Te esperamos! ✅",
          agendamentoConfirmado: true,
        },
      ],
    },
    {
      id: "clin-preco",
      rotulo: "💰 Valor da limpeza de pele e drenagem",
      mensagem: "Quanto custa a limpeza de pele e a drenagem?",
      resposta:
        "Nossa Limpeza de Pele Profunda é R$ 140,00 e a Drenagem Linfática R$ 90,00. A primeira avaliação estética é gratuita! Deseja reservar seu horário?",
      proximasOpcoes: [
        {
          id: "clin-preco-agendar",
          rotulo: "📅 Quero agendar uma avaliação gratuita!",
          mensagem: "Quero agendar a avaliação gratuita para amanhã!",
          resposta:
            "Excelente escolha! Agendado para amanhã às 15:00 com a Dra. Camila. Salvei na agenda! ✅",
          agendamentoConfirmado: true,
        },
      ],
    },
    {
      id: "clin-24h",
      rotulo: "🌙 Resposta fora do expediente",
      mensagem: "Vocês atendem e marcam consultas aos finais de semana?",
      resposta:
        "Sim! A Sofia fica ativa 24 horas por dia no WhatsApp. Se uma paciente mandar mensagem às 23h de domingo, ela já acorda na segunda com a consulta marcada!",
    },
    {
      id: "clin-lembrete",
      rotulo: "🔔 Confirmação automática de presença",
      mensagem: "Como funciona a confirmação automática de presença?",
      resposta:
        "O sistema envia um lembrete no WhatsApp 2h antes com confirmação de presença em 1 toque. Reduz faltas em até 80% e mantém suas salas sempre cheias!",
    },
  ],
  salao: [
    {
      id: "sal-horario",
      rotulo: "📅 Vaga para escova e manicure",
      mensagem: "Olá! Tem horário amanhã para escova modelada?",
      resposta:
        "Olá! Sou a Camila do Studio Bella Hair 💇‍♀️ Temos vaga amanhã às 11:00 e às 16:30 com a Jéssica. Qual você prefere?",
      proximasOpcoes: [
        {
          id: "sal-horario-1630",
          rotulo: "📅 Pode marcar às 16:30!",
          mensagem: "Pode marcar às 16:30, por favor!",
          resposta:
            "Agendamento confirmado para amanhã às 16:30 com a Jéssica! Salvei na agenda. Te esperamos! ✅",
          agendamentoConfirmado: true,
        },
        {
          id: "sal-horario-11",
          rotulo: "📅 Prefiro às 11:00!",
          mensagem: "Prefiro às 11:00, por favor!",
          resposta:
            "Confirmadíssimo para amanhã às 11:00 com a Jéssica! Salvei na agenda. ✅",
          agendamentoConfirmado: true,
        },
      ],
    },
    {
      id: "sal-preco",
      rotulo: "💰 Tabela de preços de escova e manicure",
      mensagem: "Quanto custa o pé e mão e a escova?",
      resposta:
        "Nossa Escova Modelada sai por R$ 60,00 e Manicure + Pedicure por R$ 55,00. Quer reservar um horário para ficar pronta para o fim de semana?",
    },
    {
      id: "sal-24h",
      rotulo: "🌙 Atendimento aos domingos e à noite",
      mensagem: "Consigo agendar de madrugada ou domingo?",
      resposta:
        "Com certeza! A Camila atende no WhatsApp do salão dia e noite. Suas clientes mandam mensagem na hora que têm tempo e o salão nunca perde vendas.",
    },
    {
      id: "sal-lembrete",
      rotulo: "🔔 Lembrete anti-falta para clientes",
      mensagem: "Como o salão evita clientes que esquecem o horário?",
      resposta:
        "O atendente dispara uma confirmação automática 2h antes pelo WhatsApp. A cliente confirma com 1 toque e seu salão não perde o horário vago!",
    },
  ],
  geral: [
    {
      id: "geral-preco",
      rotulo: "💰 Preço dos planos da Nexora",
      mensagem: "Qual o valor da mensalidade e dos planos da Nexora?",
      resposta:
        "O plano Nexora Atendente custa R$ 97,00/mês e o Nexora Completo R$ 197,00/mês. A primeira semana é 100% grátis e sem cartão de crédito!",
      proximasOpcoes: [
        {
          id: "geral-preco-24h",
          rotulo: "🌙 O atendente funciona de madrugada?",
          mensagem: "O atendente realmente responde de madrugada e no domingo?",
          resposta:
            "Sim! Ele roda na nuvem 24 horas por dia, 7 dias por semana. Não precisa de computador nem celular ligado. Responde em menos de 10 segundos no seu WhatsApp.",
        },
        {
          id: "geral-preco-qr",
          rotulo: "📱 Como conecto no meu número?",
          mensagem: "Como conecto o atendente no meu número de WhatsApp?",
          resposta:
            "É tão simples quanto conectar o WhatsApp Web: você lê um QR Code na tela da Nexora com seu celular e ele já começa a atender em 2 minutos!",
        },
      ],
    },
    {
      id: "geral-24h",
      rotulo: "🌙 Plantão 24 horas no WhatsApp",
      mensagem: "O atendente realmente responde de madrugada e no domingo?",
      resposta:
        "Exatamente! Ele roda na nuvem 24 horas por dia, 7 dias por semana. Não precisa de computador nem celular ligado. Responde em menos de 10 segundos no seu próprio WhatsApp comercial.",
      proximasOpcoes: [
        {
          id: "geral-24h-agenda",
          rotulo: "📅 Como ele fecha agendamento?",
          mensagem: "Como o atendente fecha agendamentos na agenda?",
          resposta:
            "Ele consulta sua grade de horários cadastrada, oferece as vagas disponíveis para o cliente e registra o agendamento automaticamente, enviando link e lembrete anti-falta!",
        },
      ],
    },
    {
      id: "geral-agenda",
      rotulo: "📅 Teste de agendamento automático",
      mensagem: "Como o atendente fecha agendamento direto na agenda?",
      resposta:
        "Ele mostra os horários livres para o cliente no WhatsApp, fecha a reserva na hora e envia um lembrete anti-falta 2 horas antes. Veja a demonstração!",
      proximasOpcoes: [
        {
          id: "geral-agenda-confirmar",
          rotulo: "📅 Quero agendar para amanhã às 16h!",
          mensagem: "Pode ser amanhã às 16:00, por favor!",
          resposta:
            "Perfeito! Agendado para amanhã às 16:00. Salvei na agenda. Tenha uma ótima noite! ✅",
          agendamentoConfirmado: true,
        },
      ],
    },
    {
      id: "geral-garantia",
      rotulo: "🛡️ Garantia de satisfação de 30 dias",
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
  barbearia: {
    nomeEmpresa: "Barbearia do Léo",
    nomeAtendente: "Bia",
    avatarLetra: "💈",
    corAvatar: "bg-[#1E293B]",
    subtitulo: "Cortes, Barba e Pigmentação",
    saudacaoInicial:
      "Olá! Sou a Bia, atendente virtual da Barbearia do Léo 💈\n\nPosso consultar horários livres com os barbeiros, informar preços ou agendar seu corte para hoje ou amanhã. Toque em uma pergunta abaixo para ver como eu respondo!",
  },
  clinica: {
    nomeEmpresa: "Clínica Renove Estética",
    nomeAtendente: "Sofia",
    avatarLetra: "✨",
    corAvatar: "bg-[#334155]",
    subtitulo: "Procedimentos e Estética Avançada",
    saudacaoInicial:
      "Olá! Bem-vinda à Clínica Renove Estética ✨ Sou a Sofia, assistente virtual.\n\nQuer agendar uma avaliação, tirar dúvidas sobre valores ou ver horários com as especialistas? Toque em uma pergunta abaixo!",
  },
  salao: {
    nomeEmpresa: "Studio Bella Hair",
    nomeAtendente: "Camila",
    avatarLetra: "💇‍♀️",
    corAvatar: "bg-[#3B1F2B]",
    subtitulo: "Cabelos, Unhas e Make",
    saudacaoInicial:
      "Olá! Sou a Camila do Studio Bella Hair 💇‍♀️\n\nPosso agendar escova, mechas, manicure ou tirar dúvidas sobre valores. Toque em uma das opções abaixo para testar o atendimento!",
  },
  geral: {
    nomeEmpresa: "Nexora · Atendente Virtual",
    nomeAtendente: "Bia",
    avatarLetra: "✦",
    corAvatar: "bg-nx-gold",
    subtitulo: "Atendimento 24h no WhatsApp",
    saudacaoInicial:
      "Olá! Sou o Atendente Virtual da Nexora 🚀\n\nRespondo clientes no seu WhatsApp 24 horas por dia, tiro dúvidas e fecho agendamentos sozinho. Escolha uma das perguntas abaixo para ver a velocidade da resposta!",
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
  const [opcoesAtivas, setOpcoesAtivas] = useState<OpcaoPergunta[]>([]);
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
  }, [mensagens, digitando, visiveisCena, digitandoCena, modo, opcoesAtivas]);

  function reiniciarConversa() {
    const config = CONFIG_NICHOS[nicho];
    const iniciais = PERGUNTAS_POR_NICHO[nicho];
    setDigitando(false);
    setOpcoesAtivas(iniciais);
    setMensagens([
      {
        id: `msg-${Date.now()}`,
        de: "atendente",
        texto: config.saudacaoInicial,
        hora: horaAtualFormatada(),
        opcoes: iniciais,
      },
    ]);
  }

  // EXCLUSIVO POR SELEÇÃO: o simulador só responde mensagens selecionáveis
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

    // Opcional: dispara para a rota /api/demo/chat em background
    fetch("/api/demo/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: opcao.mensagem, nicho }),
    }).catch(() => {});

    const delay = Math.min(1300, Math.max(800, opcao.resposta.length * 10));

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
  const terminouCena = visiveisCena >= linhasCena.length && !digitandoCena;

  return (
    <div id="simulador" className="w-full scroll-mt-24">
      {/* SELETOR DE MODO: SIMULAÇÃO INTERATIVA OU CENAS PRONTAS */}
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
            💬 Simulação interativa
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
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  nicho === tab.id
                    ? "border border-nx-gold/60 bg-nx-gold/15 text-nx-gold"
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

      {/* CHIPS DE OPÇÕES SELECIONÁVEIS RÁPIDAS (MODO INTERATIVO) */}
      {modo === "INTERATIVO" && opcoesAtivas.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-center gap-1.5 px-2">
          <span className="text-[11px] font-medium text-nx-muted mr-1">Toque para perguntar:</span>
          {opcoesAtivas.map((op) => (
            <button
              key={op.id}
              type="button"
              onClick={() => selecionarPergunta(op)}
              disabled={digitando}
              className="rounded-full border border-nx-border/80 bg-nx-surface/90 px-3 py-1 text-[11px] font-medium text-nx-secondary shadow-sm transition-all hover:border-nx-gold/60 hover:bg-nx-surface-2 hover:text-nx-gold active:scale-[0.97] disabled:opacity-50"
            >
              {op.rotulo}
            </button>
          ))}
        </div>
      )}

      {/* DISPOSITIVO SMARTPHONE ULTRA-REALISTA */}
      <div className="mx-auto max-w-[420px] rounded-[3rem] border border-nx-border-2 bg-gradient-to-b from-[#2A2E3D] via-[#1A1D27] to-[#0E1017] p-3 shadow-2xl ring-1 ring-white/10">
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

            <div className="mx-auto max-w-[290px] rounded-lg bg-[#182229]/90 px-3 py-1.5 text-center text-[10px] leading-tight text-[#FFD279] shadow-sm">
              🔒 As mensagens são protegidas e enviadas em tempo real como no WhatsApp oficial.
            </div>

            {modo === "INTERATIVO" ? (
              <>
                {mensagens.map((msg, indexMsg) => {
                  const ehUltimaAtendente =
                    msg.de === "atendente" && indexMsg === mensagens.length - 1;
                  return (
                    <div
                      key={msg.id}
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

                        {/* BOTÕES DE RESPOSTA INTERATIVOS ESTILO WHATSAPP */}
                        {ehUltimaAtendente && msg.opcoes && msg.opcoes.length > 0 && !digitando && (
                          <div className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8696A0]">
                              Escolha como responder:
                            </p>
                            <div className="flex flex-col gap-1.5">
                              {msg.opcoes.map((opcao) => (
                                <button
                                  key={opcao.id}
                                  type="button"
                                  onClick={() => selecionarPergunta(opcao)}
                                  disabled={digitando}
                                  className="flex items-center justify-between rounded-xl border border-[#00A884]/40 bg-[#00A884]/15 px-3 py-2 text-left text-xs font-semibold text-[#E9EDEF] shadow-sm transition-all hover:bg-[#00A884]/30 hover:border-[#00A884] active:scale-[0.98] disabled:opacity-50"
                                >
                                  <span>{opcao.rotulo}</span>
                                  <span className="text-xs text-[#00A884]">→</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

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

          {/* BARRA INFERIOR EXCLUSIVA POR SELEÇÃO (SEM CAMPO DE DIGITAÇÃO LIVRE) */}
          {modo === "INTERATIVO" ? (
            <div className="flex items-center justify-between border-t border-[#2A3942]/60 bg-[#202C33] px-3.5 py-2.5">
              <div className="flex items-center gap-2 text-xs text-[#8696A0]">
                <span className="flex h-2 w-2 rounded-full bg-[#00A884] animate-pulse" />
                <span className="text-[11px] text-[#A7B2B8]">Escolha uma opção para ver a resposta imediata</span>
              </div>
              <button
                type="button"
                onClick={reiniciarConversa}
                className="rounded-lg border border-[#2A3942] bg-[#182229] px-2.5 py-1 text-[11px] font-semibold text-[#8696A0] hover:text-[#E9EDEF] hover:border-[#00A884] transition-colors"
                title="Reiniciar conversa do zero"
              >
                🔄 Reiniciar
              </button>
            </div>
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
          ✦ Começar teste grátis (Sem cartão) →
        </Link>
        <p className="mt-2 text-[11px] text-nx-muted">
          Ou se preferir,{" "}
          <a
            href={linkWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            className="text-nx-secondary underline hover:text-nx-primary"
          >
            no WhatsApp de Teste
          </a>
          .
        </p>
      </div>

      <div className="mt-2 text-center text-[10px] text-nx-muted">
        <span>Simulação interativa • Atendente 24h e agendamento automático</span>
      </div>
    </div>
  );
}
