import { horariosLivres } from "@/lib/agenda/livres";
import { configuracaoDaIaFaltando } from "@/lib/ai/provider";
import { estadoDaEmpresa } from "@/lib/billing/guarda";
import { prisma } from "@/lib/db";
import { telefoneFalado } from "@/lib/recuperacao/telefone";
import type { BusinessHour } from "@/lib/validation";
import { MINUTOS_SEM_RESPOSTA, SEMANA_GRATIS_CONVERSAS, SEMANA_GRATIS_DIAS, TETO_CONVERSAS_MES } from "./constantes";
import {
  horarioFalado,
  instanteLocal,
  localDe,
  proximaAbertura,
  proximoFechamento,
  quandoFalado,
  somarDias,
  textoDaVolta,
  ultimoFechamento,
} from "./datas";
import { duracaoFalada, fatosDaEmpresa, precoFalado, type Fatos, type ServicoDoAtendente } from "./fatos";
import type { conversaDeExemplo, Jeito } from "./jeitos";
import { escolherTres, formatarOpcao } from "./oferta";
import { acessoDoAtendente, fimDaSemanaGratis, lojaFechada, podeLigar, type Acesso } from "./portao";
import { quandoAtendeTexto, semanaDoAtendente, type DiaDesenhado } from "./semana";
import { usoDoAtendente } from "./uso";

/**
 * O QUE A TELA "ATENDENTE VIRTUAL" MOSTRA.
 *
 * Tudo que a tela precisa, montado no servidor a partir do que já existe: os
 * fatos da empresa (agenda e cadastro), o uso, a conta e as anotações. A tela
 * não pede nada que o dono já tenha dito em outro lugar — ela mostra e aponta
 * onde ajustar.
 *
 * Nenhuma frase daqui fala de tecnologia: o dono vê um funcionário.
 */

export type Tom = "ATENDENDO" | "DE_OLHO" | "ESPERANDO" | "PARADO" | "DESLIGADO";

export type Contagem = { conversas: number; marcados: number; valorMarcadoCents: number };

export type TelaDoAtendente = {
  empresa: string;
  nome: string;
  jeito: Jeito;
  marcaDireto: boolean;
  expediente: boolean;
  ligado: boolean;
  testado: boolean;
  whatsappLigado: boolean;
  acesso: Acesso;
  podeLigar: boolean;
  estado: { texto: string; tom: Tom };
  uso: { texto: string; conversasNoMes: number; teto: number };
  /** A conversa do passo 1: dados de verdade, ou de exemplo — e a tela diz qual. */
  exemplo: { ehExemplo: boolean; dados: Parameters<typeof conversaDeExemplo>[1] };
  sabe: {
    servicos: { nome: string; detalhe: string; semPreco: boolean }[];
    horario: string;
    fechadoHoje: boolean;
    perguntas: string[];
    endereco: string;
    pagamento: string;
    linkAgenda: string | null;
  };
  semana: { dias: DiaDesenhado[]; texto: string[] };
  enquantoFechado: Contagem;
  precisaDeVoce: {
    id: string;
    conversationId: string;
    cliente: string;
    telefone: string;
    motivo: string;
    urgente: boolean;
  }[];
  /** O que a semana grátis fez — a parede depois dela mostra isso. null para quem tem plano. */
  resultadoDaSemana: Contagem | null;
  /** Como o simulador responde agora: loja fechada, ou expediente sem ninguém respondendo. */
  contextoAgora: "FECHADO" | "EXPEDIENTE";
  /** As respostas livres estão funcionando? Sem elas, o resto continua. */
  respostasLivres: boolean;
};

const DIA_MS = 86_400_000;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function estadoDoAtendente(p: {
  ligado: boolean;
  nome: string;
  acesso: Acesso;
  whatsappLigado: boolean;
  horarios: BusinessHour[];
  diasFechados: string[];
  expediente: boolean;
  agora: Date;
}): { texto: string; tom: Tom } {
  const nome = p.nome.trim();
  const Quem = nome || "O Atendente";
  const quem = nome || "o Atendente";

  if (!p.ligado) return { texto: "Desligado: nenhuma mensagem sai sozinha.", tom: "DESLIGADO" };
  if (p.acesso === "SEMANA_ACABOU") {
    return { texto: `A semana por nossa conta terminou: ${quem} parou de responder.`, tom: "PARADO" };
  }
  if (!p.whatsappLigado) {
    return { texto: `O WhatsApp está desligado: ${quem} não tem por onde responder.`, tom: "PARADO" };
  }
  if (p.acesso === "TETO") {
    return {
      texto: `Chegou às ${TETO_CONVERSAS_MES} conversas do mês: agora ${quem} só avisa que você responde.`,
      tom: "DE_OLHO",
    };
  }
  if (lojaFechada({ horarios: p.horarios, diasFechados: p.diasFechados, agora: p.agora })) {
    return { texto: `${Quem} está atendendo agora.`, tom: "ATENDENDO" };
  }
  if (p.expediente) {
    return {
      texto: `Você está atendendo. Se ninguém responder em ${MINUTOS_SEM_RESPOSTA} minutos, ${quem} entra.`,
      tom: "DE_OLHO",
    };
  }
  const volta = textoDaVolta(proximoFechamento(p.horarios, p.diasFechados, p.agora), p.agora);
  return {
    texto: volta ? `Você está atendendo. ${Quem} volta ${volta}, quando você fechar.` : "Você está atendendo.",
    tom: "ESPERANDO",
  };
}

export function textoDoUso(p: {
  acesso: Acesso;
  agora: Date;
  uso: { conversasNoMes: number; conversasNaSemana: number; primeiraVezEm: Date | null };
}): string {
  if (p.acesso === "INCLUIDO" || p.acesso === "TETO") {
    return `${p.uso.conversasNoMes} de ${TETO_CONVERSAS_MES} conversas neste mês`;
  }
  if (p.acesso === "SEMANA_ACABOU") return "A semana por nossa conta terminou.";
  if (!p.uso.primeiraVezEm) {
    return `Primeira semana por nossa conta: ${SEMANA_GRATIS_DIAS} dias ou ${SEMANA_GRATIS_CONVERSAS} conversas, a partir de quando você ligar.`;
  }
  const dias = Math.max(1, Math.ceil((fimDaSemanaGratis(p.uso.primeiraVezEm).getTime() - p.agora.getTime()) / DIA_MS));
  const conversas = Math.max(0, SEMANA_GRATIS_CONVERSAS - p.uso.conversasNaSemana);
  return `Semana por nossa conta: ${dias === 1 ? "falta" : "faltam"} ${plural(dias, "dia", "dias")} ou ${plural(conversas, "conversa", "conversas")}.`;
}

function contar(linhas: { respostas: number; marcados: number; valorMarcadoCents: number }[]): Contagem {
  return {
    // O aviso de teto grava zero respostas: não conta como conversa atendida.
    conversas: linhas.filter((l) => l.respostas > 0).length,
    marcados: linhas.reduce((soma, l) => soma + l.marcados, 0),
    valorMarcadoCents: linhas.reduce((soma, l) => soma + l.valorMarcadoCents, 0),
  };
}

/** O detalhe que vai na oferta de horários, igual ao do motor: "R$ 45,00, 40 min". */
function detalheDaOferta(s: ServicoDoAtendente): string {
  return s.precoCents > 0 ? `${precoFalado(s.precoCents)}, ${duracaoFalada(s.duracaoMin)}` : duracaoFalada(s.duracaoMin);
}

/**
 * A conversa do passo 1, com o nome do negócio, o primeiro serviço com preço e
 * os horários livres de verdade do próximo dia aberto. A cena é a noite anterior
 * a esse dia, para o "amanhã" da conversa ser verdade. Sem serviço ou sem vaga,
 * os horários são de exemplo — e a tela diz isso.
 */
async function exemploDaConversa(companyId: string, fatos: Fatos, agora: Date): Promise<TelaDoAtendente["exemplo"]> {
  const servico = fatos.servicos.find((s) => s.precoCents > 0) ?? fatos.servicos[0] ?? null;
  const amanha = somarDias(localDe(agora).data, 1);
  const abertura = proximaAbertura(fatos.horarios, fatos.diasFechados, instanteLocal(amanha, 0));
  const dia = abertura ? localDe(abertura).data : amanha;
  const noiteAnterior = instanteLocal(somarDias(dia, -1), 22 * 60);
  const base = {
    empresa: fatos.empresa,
    nome: fatos.nome,
    cliente: "Marina",
    volta: abertura ? textoDaVolta(abertura, noiteAnterior) : null,
    cumprimento: "Boa noite",
  };

  if (servico) {
    const livres = await horariosLivres({ companyId, duracaoMin: servico.duracaoMin, dias: [dia], agora }).catch(() => []);
    const { opcoes } = escolherTres(livres, { dia });
    if (opcoes.length >= 2) {
      return {
        ehExemplo: false,
        dados: {
          ...base,
          servico: servico.nome,
          detalhe: detalheDaOferta(servico),
          opcoes: opcoes.map((o, i) => formatarOpcao(i + 1, o)),
          escolhida: { quando: quandoFalado(opcoes[1].inicio), profissional: opcoes[1].profissional },
        },
      };
    }
  }

  const inicios = [9 * 60 + 30, 11 * 60, 16 * 60].map((minutos) => instanteLocal(dia, minutos));
  return {
    ehExemplo: true,
    dados: {
      ...base,
      servico: servico?.nome ?? "Atendimento",
      detalhe: servico ? detalheDaOferta(servico) : null,
      opcoes: inicios.map((inicio, i) => formatarOpcao(i + 1, { inicio, fim: inicio, profissional: null })),
      escolhida: { quando: quandoFalado(inicios[1]), profissional: null },
    },
  };
}

const CONTAGEM = { respostas: true, marcados: true, valorMarcadoCents: true } as const;

export async function telaDoAtendente(companyId: string, agora: Date = new Date()): Promise<TelaDoAtendente> {
  const [fatos, perfil, estadoDaConta, uso] = await Promise.all([
    fatosDaEmpresa(companyId),
    prisma.companyProfile.findUnique({
      where: { companyId },
      select: { plantaoAtivo: true, atendenteTestadoEm: true, whatsappStatus: true, whatsappInstance: true },
    }),
    estadoDaEmpresa(companyId),
    usoDoAtendente(companyId, agora),
  ]);

  const acesso = acessoDoAtendente({ estado: estadoDaConta, ...uso, agora });
  const whatsappLigado = Boolean(perfil?.whatsappInstance) && perfil?.whatsappStatus === "CONNECTED";
  const ligado = perfil?.plantaoAtivo ?? false;
  const desde = ultimoFechamento(fatos.horarios, fatos.diasFechados, agora);
  const naSemanaGratis = (acesso === "SEMANA_GRATIS" || acesso === "SEMANA_ACABOU") && uso.primeiraVezEm;

  const [doFechamento, pendentes, daSemana, exemplo] = await Promise.all([
    desde
      ? prisma.atendenteAtendimento.findMany({
          where: { companyId, foraDoHorario: true, atualizadoEm: { gte: desde } },
          select: CONTAGEM,
        })
      : Promise.resolve([]),
    prisma.atendenteAtendimento.findMany({
      where: {
        companyId,
        precisaDoDono: true,
        resolvidoEm: null,
        atualizadoEm: { gte: new Date(agora.getTime() - 7 * DIA_MS) },
      },
      select: {
        id: true,
        conversationId: true,
        clienteNome: true,
        clienteTelefone: true,
        motivo: true,
        urgente: true,
      },
      orderBy: [{ urgente: "desc" }, { atualizadoEm: "desc" }],
      take: 20,
    }),
    naSemanaGratis
      ? prisma.atendenteAtendimento.findMany({
          where: { companyId, criadoEm: { gte: uso.primeiraVezEm!, lt: fimDaSemanaGratis(uso.primeiraVezEm!) } },
          select: CONTAGEM,
        })
      : Promise.resolve([]),
    exemploDaConversa(companyId, fatos, agora),
  ]);

  return {
    empresa: fatos.empresa,
    nome: fatos.nome,
    jeito: fatos.jeito,
    marcaDireto: fatos.marcaDireto,
    expediente: fatos.expediente,
    ligado,
    testado: Boolean(perfil?.atendenteTestadoEm),
    whatsappLigado,
    acesso,
    podeLigar: podeLigar(acesso),
    estado: estadoDoAtendente({
      ligado,
      nome: fatos.nome,
      acesso,
      whatsappLigado,
      horarios: fatos.horarios,
      diasFechados: fatos.diasFechados,
      expediente: fatos.expediente,
      agora,
    }),
    uso: { texto: textoDoUso({ acesso, agora, uso }), conversasNoMes: uso.conversasNoMes, teto: TETO_CONVERSAS_MES },
    exemplo,
    sabe: {
      servicos: fatos.servicos.map((s) => ({
        nome: s.nome,
        detalhe:
          s.precoCents > 0
            ? `${precoFalado(s.precoCents)} · ${duracaoFalada(s.duracaoMin)}`
            : `${duracaoFalada(s.duracaoMin)} · sem preço cadastrado`,
        semPreco: s.precoCents === 0,
      })),
      horario: horarioFalado(fatos.horarios),
      fechadoHoje: fatos.diasFechados.includes(localDe(agora).data),
      perguntas: fatos.perguntas.map((p) => p.question).slice(0, 30),
      endereco: fatos.endereco,
      pagamento: fatos.pagamento,
      linkAgenda: fatos.linkAgenda,
    },
    semana: { dias: semanaDoAtendente(fatos.horarios), texto: quandoAtendeTexto(fatos.horarios) },
    enquantoFechado: contar(doFechamento),
    precisaDeVoce: pendentes.map((p) => ({
      id: p.id,
      conversationId: p.conversationId,
      cliente: p.clienteNome ?? telefoneFalado(p.clienteTelefone),
      telefone: p.clienteTelefone,
      motivo: p.motivo,
      urgente: p.urgente,
    })),
    resultadoDaSemana: naSemanaGratis ? contar(daSemana) : null,
    contextoAgora: lojaFechada({ horarios: fatos.horarios, diasFechados: fatos.diasFechados, agora }) ? "FECHADO" : "EXPEDIENTE",
    respostasLivres: configuracaoDaIaFaltando() === null,
  };
}
