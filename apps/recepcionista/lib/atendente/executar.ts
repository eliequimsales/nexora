import { randomUUID } from "node:crypto";
import { Prisma } from "@nexora/recepcionista-prisma";
import { horarioDaEmpresa, lerDiasFechados } from "@/lib/agenda/horario";
import { horariosLivres } from "@/lib/agenda/livres";
import { marcarNaAgenda } from "@/lib/agenda/marcacao";
import { generateReceptionistReply } from "@/lib/ai/provider";
import type { EstadoConta } from "@/lib/billing/acesso";
import { estadoDaEmpresa } from "@/lib/billing/guarda";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { JANELA_DIAS } from "@/lib/recuperacao/atribuicao";
import { telefoneFalado } from "@/lib/recuperacao/telefone";
import { enviarEmail } from "@/lib/reengajamento/email";
import { recordKnowledgeGap } from "@/lib/training";
import type { BusinessHour } from "@/lib/validation";
import { enviarWhatsApp } from "@/lib/whatsapp/envio";
import { ESPERA_DA_RAJADA_MS, MAX_RESPOSTAS_POR_DIA, TETO_CONVERSAS_MES } from "./constantes";
import { localDe, proximaAbertura, textoDaVolta } from "./datas";
import { fatosDaEmpresa, lerPalavrasDoDono } from "./fatos";
import { apresentacao, primeiroNomeDoCliente, textosDoJeito } from "./jeitos";
import { responder, type Contexto, type SaidaDoMotor } from "./motor";
import { lerEstado } from "./oferta";
import { acessoDoAtendente, decidirQuando, lojaFechada, type Silencio } from "./portao";
import { atendimentoDoDia, registrarAtendimento, usoDoAtendente, type RegistroDeAtendimento } from "./uso";

/**
 * O CAMINHO REAL DO WHATSAPP.
 *
 * O motor decide O QUE responder. Aqui se decide SE e QUANDO a resposta sai,
 * e o que fica registrado depois:
 *
 *   1. O plano (puro): ligado, dono fora da conversa, loja fechada ou 5 minutos
 *      sem resposta no expediente, plano ou semana grátis, teto do mês, limite
 *      do dia.
 *   2. Rajada: pelo webhook, espera um instante — quem manda "oi", "tudo bem?"
 *      e "tem horário amanhã?" recebe uma resposta só, para as três.
 *   3. O motor, com a agenda, a marcação e a IA de verdade.
 *   4. Conferência antes de enviar: se a equipe respondeu enquanto a resposta
 *      era preparada, nada sai.
 *   5. Estado e pendências persistidos antes da resposta, mensagem salva, atendimento
 *      do dia, anotação para o dono, lacuna no Treinamento, Onda que virou
 *      marcação e aviso de urgência.
 *
 * Quem chama: o webhook (lib/conversation-service.ts) e o resgate de cada
 * minuto (lib/atendente/resgate.ts). Erro de envio sobe — o resgate precisa
 * dele para parar a rodada quando o servidor do WhatsApp cai.
 */

export type Origem = "WEBHOOK" | "RESGATE";

export type MensagemDaConversa = {
  id: string;
  role: "CUSTOMER" | "AI" | "HUMAN" | "SYSTEM";
  content: string;
  createdAt: Date;
};

export type MotivoDoSilencio =
  | Silencio
  | "SEM_CONVERSA"
  | "EQUIPE_NA_CONVERSA"
  | "SEM_WHATSAPP"
  | "TETO_AVISADO"
  | "LIMITE_DO_DIA"
  | "EM_PROCESSAMENTO"
  | "RAJADA";

export type Plano =
  | { acao: "SILENCIO"; motivo: MotivoDoSilencio }
  | { acao: "ESPERAR" }
  | { acao: "AVISO_DO_TETO" }
  | { acao: "AVISO_DO_LIMITE" }
  | { acao: "RESPONDER"; texto: string; primeiraDoDia: boolean; contexto: Contexto };

export type ResultadoDoAtendimento =
  | { acao: "RESPONDEU"; mensagens: number }
  | { acao: "ESPERAR" }
  | { acao: "SILENCIO"; motivo: MotivoDoSilencio };

const silencio = (motivo: MotivoDoSilencio): { acao: "SILENCIO"; motivo: MotivoDoSilencio } => ({
  acao: "SILENCIO",
  motivo,
});

/** O texto que o motor lê: as mensagens pendentes, juntas, até este tamanho. */
const MAX_TEXTO = 1_000;
const MAX_TRECHO = 200;
const DIA_MS = 86_400_000;
const PRAZO_EXECUCAO_MS = 5 * 60_000;

type ExecucaoPersistida = {
  token: string;
  mensagemId: string;
  iniciadaEm: string;
  proposta?: {
    estado: Prisma.InputJsonValue | null;
    mensagens: string[];
    reserva?: { appointmentId: string | null; servico: string; inicio: string };
  };
};

function execucaoDoEstado(estado: unknown): ExecucaoPersistida | null {
  if (!estado || typeof estado !== "object") return null;
  const execucao = (estado as Record<string, unknown>)._execucaoAtendente as ExecucaoPersistida | undefined;
  return execucao && typeof execucao.token === "string" && typeof execucao.mensagemId === "string"
    && typeof execucao.iniciadaEm === "string" && Number.isFinite(Date.parse(execucao.iniciadaEm)) ? execucao : null;
}

function estadoSemExecucao(estado: unknown): Prisma.InputJsonValue | null {
  if (!estado || typeof estado !== "object" || Array.isArray(estado)) return null;
  const { _execucaoAtendente: _execucao, ...restante } = estado as Record<string, Prisma.InputJsonValue>;
  return Object.keys(restante).length ? restante : null;
}

/**
 * O que o cliente escreveu depois da última resposta — do Atendente ou da equipe
 * pelo painel. Anotação do sistema não é resposta. (A resposta do dono pelo
 * celular não vira mensagem salva: ela chega como `donoAssumiuEm`.)
 */
export function semResposta(mensagens: MensagemDaConversa[]): MensagemDaConversa[] {
  const pendentes: MensagemDaConversa[] = [];
  for (let i = mensagens.length - 1; i >= 0; i--) {
    const m = mensagens[i];
    if (m.role === "SYSTEM") continue;
    if (m.role !== "CUSTOMER") break;
    pendentes.unshift(m);
  }
  return pendentes;
}

export function planejar(p: {
  ligado: boolean;
  statusDaConversa: string;
  donoAssumiuEm: Date | null;
  mensagens: MensagemDaConversa[];
  estadoDaConta: EstadoConta;
  uso: { conversasNoMes: number; conversasNaSemana: number; primeiraVezEm: Date | null };
  /** Respostas do Atendente nesta conversa hoje; null quando ainda não houve nenhuma. */
  respostasHoje: number | null;
  horarios: BusinessHour[];
  diasFechados: string[];
  expediente: boolean;
  temWhatsApp: boolean;
  agora: Date;
  origem: Origem;
}): Plano {
  if (!p.ligado) return silencio("DESLIGADO");
  // A equipe assumiu pelo painel: a conversa é dela até devolver.
  if (p.statusDaConversa === "HUMAN" || p.statusDaConversa === "WAITING_HUMAN") return silencio("EQUIPE_NA_CONVERSA");

  const pendentes = semResposta(p.mensagens);
  if (pendentes.length === 0) return silencio("JA_RESPONDIDA");

  // O teto e a semana grátis barram conversa NOVA. A que já foi atendida hoje
  // já está na conta e segue até o fim do dia.
  const jaContada = p.respostasHoje !== null && p.respostasHoje > 0 ? 1 : 0;
  const acesso = acessoDoAtendente({
    estado: p.estadoDaConta,
    primeiraVezEm: p.uso.primeiraVezEm,
    conversasNaSemana: Math.max(0, p.uso.conversasNaSemana - jaContada),
    conversasNoMes: Math.max(0, p.uso.conversasNoMes - jaContada),
    agora: p.agora,
  });

  const quando = decidirQuando({
    ligado: true,
    acesso,
    horarios: p.horarios,
    diasFechados: p.diasFechados,
    expediente: p.expediente,
    donoAssumiuEm: p.donoAssumiuEm,
    ultimaDoClienteEm: pendentes[pendentes.length - 1].createdAt,
    respondidaDepois: false,
    agora: p.agora,
    origem: p.origem,
  });
  if (quando.acao === "SILENCIO") return silencio(quando.motivo);
  if (quando.acao === "ESPERAR") return { acao: "ESPERAR" };
  if (!p.temWhatsApp) return silencio("SEM_WHATSAPP");

  // Passou do teto: um texto fixo por conversa por dia, sem IA.
  if (acesso === "TETO") return p.respostasHoje === null ? { acao: "AVISO_DO_TETO" } : silencio("TETO_AVISADO");

  if (p.respostasHoje !== null && p.respostasHoje >= MAX_RESPOSTAS_POR_DIA) {
    return p.respostasHoje === MAX_RESPOSTAS_POR_DIA ? { acao: "AVISO_DO_LIMITE" } : silencio("LIMITE_DO_DIA");
  }

  return {
    acao: "RESPONDER",
    texto: pendentes
      .map((m) => m.content.trim())
      .filter(Boolean)
      .join("\n")
      .slice(-MAX_TEXTO),
    primeiraDoDia: p.respostasHoje === null,
    contexto: lojaFechada({ horarios: p.horarios, diasFechados: p.diasFechados, agora: p.agora }) ? "FECHADO" : "EXPEDIENTE",
  };
}

/** O telefone do cadastro como número de WhatsApp: "(11) 97777-6666" → "5511977776666". */
export function numeroDoDono(bruto: string | null | undefined): string | null {
  const d = (bruto ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
}

/** O aviso que vai para o WhatsApp do próprio dono quando alguém escreve uma urgência. */
export function avisoDeUrgencia(p: { cliente: string | null; telefone: string; trecho: string }): string {
  const quem = p.cliente ? `${p.cliente} (${telefoneFalado(p.telefone)})` : telefoneFalado(p.telefone);
  return (
    `Urgência no seu WhatsApp: ${quem} escreveu "${p.trecho}". ` +
    "A mensagem foi identificada como urgente e precisa da atenção da equipe. " +
    "Fale com a pessoa assim que puder."
  );
}

/** O nome do WhatsApp inteiro, para a agenda — só quando o primeiro nome parece nome. */
function nomeParaAgenda(nomeDoWhatsApp: string | null): string | null {
  if (!primeiroNomeDoCliente(nomeDoWhatsApp)) return null;
  return (nomeDoWhatsApp ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
}

type Dependencias = { esperar: (ms: number) => Promise<void> };

const dependenciasReais: Dependencias = {
  esperar: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
};

export async function atender(
  p: { companyId: string; conversationId: string; origem: Origem; agora?: Date },
  deps: Dependencias = dependenciasReais,
): Promise<ResultadoDoAtendimento> {
  const agora = p.agora ?? new Date();
  const dia = localDe(agora).data;

  const [perfil, conversaBruta, recentes] = await Promise.all([
    prisma.companyProfile.findUnique({
      where: { companyId: p.companyId },
      select: {
        plantaoAtivo: true,
        atendenteLigadoPrimeiraVezEm: true,
        atendenteExpediente: true,
        businessHours: true,
        diasFechados: true,
        handoffKeywords: true,
        whatsappInstance: true,
        whatsappStatus: true,
      },
    }),
    prisma.conversation.findFirst({
      where: { id: p.conversationId, companyId: p.companyId },
      select: {
        id: true,
        status: true,
        donoAssumiuEm: true,
        customerPhone: true,
        customerName: true,
        atendenteEstado: true,
        updatedAt: true,
      },
    }),
    prisma.message.findMany({
      where: { conversationId: p.conversationId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, role: true, content: true, createdAt: true },
    }),
  ]);
  if (!perfil || !conversaBruta) return silencio("SEM_CONVERSA");
  const conversa = conversaBruta;
  // Ligado é o que passou pelo "Ligar": ele exige o teste e grava o começo da
  // semana grátis. A chave ligada por fora dele responderia de graça para
  // sempre, porque a semana nunca começaria. Desligado, nem conta nem uso são lidos.
  if (!perfil.plantaoAtivo || !perfil.atendenteLigadoPrimeiraVezEm) return silencio("DESLIGADO");

  const mensagens: MensagemDaConversa[] = [...recentes].reverse();
  const [estadoDaConta, uso, hoje] = await Promise.all([
    estadoDaEmpresa(p.companyId),
    usoDoAtendente(p.companyId, agora),
    atendimentoDoDia(conversa.id, dia),
  ]);

  const execucaoAnterior = execucaoDoEstado(conversa.atendenteEstado);
  const plano = planejar({
    ligado: true,
    statusDaConversa: conversa.status,
    donoAssumiuEm: conversa.donoAssumiuEm,
    mensagens,
    estadoDaConta,
    uso,
    respostasHoje: hoje?.respostas ?? null,
    horarios: horarioDaEmpresa(perfil.businessHours),
    diasFechados: lerDiasFechados(perfil.diasFechados),
    expediente: perfil.atendenteExpediente,
    // Pelo webhook, a mensagem acabou de chegar por esta conexão: ela está de pé.
    temWhatsApp: Boolean(perfil.whatsappInstance) && (p.origem === "WEBHOOK" || perfil.whatsappStatus === "CONNECTED"),
    agora,
    origem: p.origem,
  });
  // Uma resposta pode ter sido salva antes de o processo finalizar o claim.
  // Ainda há trabalho de recuperação, mesmo sem mensagem do cliente pendente.
  if ((plano.acao === "SILENCIO" || plano.acao === "ESPERAR")
    && !(execucaoAnterior && plano.acao === "SILENCIO" && plano.motivo === "JA_RESPONDIDA")) return plano;

  const instance = perfil.whatsappInstance!;
  const pendentes = semResposta(mensagens);
  const ultima = pendentes[pendentes.length - 1];
  const mensagensDestaResposta: string[] = [];
  let encaminhamentoPersistido = false;
  const estadoAnterior = estadoSemExecucao(conversa.atendenteEstado);
  let execucao: ExecucaoPersistida = execucaoAnterior ?? {
    token: randomUUID(), mensagemId: ultima.id, iniciadaEm: agora.toISOString(),
  };
  let temosExecucao = false;
  let encerrada = false;
  const filtroDaExecucao = () => ({
    id: conversa.id, companyId: p.companyId,
    atendenteEstado: { path: ["_execucaoAtendente", "token"], equals: execucao.token },
  });
  const estadoComExecucao = () => ({
    ...(estadoAnterior && typeof estadoAnterior === "object" ? estadoAnterior : {}),
    _execucaoAtendente: execucao,
  }) as unknown as Prisma.InputJsonValue;

  // O prazo libera uma pendência para a equipe, nunca autoriza refazer um
  // efeito externo cujo resultado se perdeu. A nota preserva a confirmação de
  // reserva mesmo quando a resposta ao cliente não chegou a ser enviada.
  async function revisarExecucao(motivo: string): Promise<boolean> {
    const reserva = execucao.proposta?.reserva;
    const detalhe = reserva
      ? ` Reserva confirmada: ${reserva.servico}, ${reserva.inicio}; registro ${reserva.appointmentId ?? "não informado"}.`
      : " Verifique a agenda e o histórico antes de reativar; o resultado da execução pode estar incompleto.";
    const resposta = execucao.proposta?.mensagens?.length
      ? ` Resposta preparada (entrega não confirmada): ${execucao.proposta.mensagens.join("\n\n")}` : "";
    const revisada = await prisma.$transaction(async (tx) => {
      const atual = await tx.conversation.findFirst({
        where: { id: conversa.id, companyId: p.companyId }, select: { status: true, donoAssumiuEm: true },
      });
      if (!atual) return false;
      const pausar = atual.status === "AI" && !atual.donoAssumiuEm;
      const alteradas = await tx.conversation.updateMany({
        where: { ...filtroDaExecucao(), status: atual.status, donoAssumiuEm: atual.donoAssumiuEm },
        data: {
          atendenteEstado: reserva ? Prisma.DbNull : estadoAnterior ?? Prisma.DbNull,
          ...(pausar ? { status: "WAITING_HUMAN" as const, donoAssumiuEm: agora } : {}),
        },
      });
      if (!alteradas.count) return false;
      await tx.message.create({ data: { conversationId: conversa.id, role: "SYSTEM",
        content: `Revisão necessária: ${motivo}.${detalhe}${resposta}` } });
      return true;
    });
    if (revisada) encerrada = true;
    return revisada;
  }

  async function liberarExecucao(estado: Prisma.InputJsonValue | null = estadoAnterior): Promise<void> {
    if (!temosExecucao || encerrada) return;
    await prisma.conversation.updateMany({ where: filtroDaExecucao(), data: { atendenteEstado: estado ?? Prisma.DbNull } });
    encerrada = true;
  }

  if (execucaoAnterior) {
    if (agora.getTime() - Date.parse(execucaoAnterior.iniciadaEm) < PRAZO_EXECUCAO_MS) return silencio("EM_PROCESSAMENTO");
    await revisarExecucao("o processamento anterior excedeu cinco minutos; não foi repetido automaticamente")
      .catch((erro) => logError("atendente-revisao", erro, p.companyId));
    return silencio("EQUIPE_NA_CONVERSA");
  }
  if (plano.acao === "SILENCIO") return plano;

  /** Ainda é a vez do Atendente? A equipe, o dono ou uma mensagem nova podem ter chegado. */
  async function conferir(): Promise<MotivoDoSilencio | null> {
    const [atual, maisNova] = await Promise.all([
      prisma.conversation.findFirst({
        where: { id: conversa!.id, companyId: p.companyId },
        select: { status: true, donoAssumiuEm: true, atendenteEstado: true },
      }),
      prisma.message.findFirst({
        where: {
          conversationId: conversa!.id,
          role: { not: "SYSTEM" },
          ...(mensagensDestaResposta.length ? { id: { notIn: mensagensDestaResposta } } : {}),
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, role: true },
      }),
    ]);
    const nossoEncaminhamento = encaminhamentoPersistido && atual?.status === "WAITING_HUMAN"
      && atual.donoAssumiuEm?.getTime() === agora.getTime();
    if (!atual || atual.status === "HUMAN" || (atual.status === "WAITING_HUMAN" && !nossoEncaminhamento)) return "EQUIPE_NA_CONVERSA";
    if (atual.donoAssumiuEm && !nossoEncaminhamento) {
      return "DONO_ASSUMIU";
    }
    if (temosExecucao && !encerrada && execucaoDoEstado(atual.atendenteEstado)?.token !== execucao.token) {
      return "EM_PROCESSAMENTO";
    }
    if (maisNova && maisNova.id !== ultima.id) return maisNova.role === "CUSTOMER" ? "RAJADA" : "JA_RESPONDIDA";
    return null;
  }

  if (p.origem === "WEBHOOK") {
    await deps.esperar(ESPERA_DA_RAJADA_MS);
    const motivo = await conferir();
    if (motivo) return silencio(motivo);
  }

  // A posse é da mensagem, não apenas da versão que dois processos leram.
  // Quem chega depois desta gravação também vê a execução em andamento.
  try {
    const adquirida = await prisma.conversation.updateMany({
      where: { id: conversa.id, companyId: p.companyId, status: conversa.status,
        donoAssumiuEm: conversa.donoAssumiuEm, updatedAt: conversa.updatedAt },
      data: { atendenteEstado: estadoComExecucao(),
        updatedAt: new Date(Math.max(Date.now(), conversa.updatedAt.getTime() + 1)) },
    });
    if (!adquirida.count) return silencio("EM_PROCESSAMENTO");
    temosExecucao = true;
  } catch (erro) {
    // Um timeout pode ter gravado a posse. Sem confirmação, não começa o motor.
    await logError("atendente-posse", erro, p.companyId);
    return silencio("EM_PROCESSAMENTO");
  }
  const antesDePreparar = await conferir();
  if (antesDePreparar) {
    await liberarExecucao();
    return silencio(antesDePreparar);
  }

  const fatos = await fatosDaEmpresa(p.companyId);
  const t = textosDoJeito(fatos.jeito);
  const fechada = lojaFechada({ horarios: fatos.horarios, diasFechados: fatos.diasFechados, agora });
  const volta = fechada ? textoDaVolta(proximaAbertura(fatos.horarios, fatos.diasFechados, agora), agora) : null;
  const clienteNome = primeiroNomeDoCliente(conversa.customerName);

  async function enviarESalvar(textos: string[]): Promise<ResultadoDoAtendimento> {
    let enviadas = 0;
    for (const texto of textos) {
      const motivo = await conferir();
      if (motivo) {
        if (execucao.proposta?.reserva || enviadas) await revisarExecucao("a conversa mudou durante uma operação ou envio");
        else await liberarExecucao();
        return enviadas ? { acao: "RESPONDEU", mensagens: enviadas } : silencio(motivo);
      }
      try {
        const envio = await enviarWhatsApp(instance, conversa!.customerPhone, texto);
        if (!envio.messageId) throw new Error("O canal não confirmou o identificador do envio; resultado desconhecido");
        enviadas += 1;
        const salva = await prisma.message.create({ data: { conversationId: conversa!.id, role: "AI", content: texto } });
        if (salva?.id) mensagensDestaResposta.push(salva.id);
      } catch (erro) {
        await revisarExecucao("não foi possível confirmar envio e registro da resposta; não reenviar automaticamente")
          .catch((falha) => logError("atendente-revisao-envio", falha, p.companyId));
        throw erro;
      }
    }
    // Só um envio confirmado pelo canal e salvo torna uma oferta visível ao próximo
    // turno. O token impede sobrescrever a execução de outra mensagem.
    await liberarExecucao(execucao.proposta ? execucao.proposta.estado : estadoAnterior)
      .catch(async (erro) => {
        await logError("atendente-finalizacao", erro, p.companyId);
        await revisarExecucao("a resposta saiu, mas não foi possível finalizar o estado da conversa")
          .catch((falha) => logError("atendente-revisao", falha, p.companyId));
      });
    return { acao: "RESPONDEU", mensagens: enviadas };
  }

  class AtendimentoInterrompido extends Error {}

  // Uma anotação e o encaminhamento são persistidos juntos. Não se confirma
  // uma ação que só existiu no texto do motor, e um dono que assumiu no caminho
  // não pode ter seu estado sobrescrito pela resposta que estava em preparação.
  async function persistir(estado: Prisma.InputJsonValue | typeof Prisma.DbNull, motivo?: string, equipe = false,
    mensagens: string[] = [], reserva?: SaidaDoMotor["marcou"]) {
    execucao = { ...execucao, proposta: {
      estado: estado === Prisma.DbNull ? null : estado as Prisma.InputJsonValue,
      mensagens,
      ...(reserva ? { reserva: { appointmentId: reserva.appointmentId,
        servico: reserva.servico, inicio: reserva.inicio.toISOString() } } : {}),
    } };
    await prisma.$transaction(async (tx) => {
      const alteradas = await tx.conversation.updateMany({
        where: {
          ...filtroDaExecucao(),
          status: conversa!.status,
          donoAssumiuEm: conversa!.donoAssumiuEm,
        },
        data: {
          atendenteEstado: estadoComExecucao(),
          ...(equipe ? { status: "WAITING_HUMAN" as const, donoAssumiuEm: agora } : {}),
        },
      });
      if (!alteradas.count) throw new AtendimentoInterrompido();
      if (motivo) await tx.message.create({
        data: { conversationId: conversa!.id, role: "SYSTEM", content: `Anotado para você: ${motivo}` },
      });
    });
    encaminhamentoPersistido = equipe;
  }

  async function tratarFalhaDeRegistro(erro: unknown, equipe: boolean, mensagensIndependentes: string[] = []): Promise<ResultadoDoAtendimento> {
    if (erro instanceof AtendimentoInterrompido) {
      await liberarExecucao();
      return silencio("EQUIPE_NA_CONVERSA");
    }
    await logError("atendente-registro", erro, p.companyId);
    const aviso = equipe
      ? "Não consegui confirmar o encaminhamento para a equipe agora. Seu pedido continua nesta conversa, mas não tenho confirmação de que alguém foi avisado."
      : "Não consegui confirmar o registro desta etapa. Sua mensagem continua nesta conversa.";
    const revisada = await revisarExecucao("não foi possível confirmar o registro desta etapa")
      .catch(async (falha) => { await logError("atendente-revisao", falha, p.companyId); return false; });
    if (!revisada) return silencio("EQUIPE_NA_CONVERSA");
    // A pendência ficou visível e bloqueada. A própria confirmação pode sair,
    // desde que a equipe ainda não tenha assumido nem chegue nova mensagem.
    encaminhamentoPersistido = true;
    return enviarESalvar([[...mensagensIndependentes, aviso].join("\n\n")]);
  }

  const registro = (r: Omit<RegistroDeAtendimento, "companyId" | "conversationId" | "dia" | "clienteNome" | "clienteTelefone" | "foraDoHorario">) =>
    registrarAtendimento({
      companyId: p.companyId,
      conversationId: conversa.id,
      dia,
      foraDoHorario: fechada,
      clienteNome,
      clienteTelefone: conversa.customerPhone,
      ...r,
    }).catch((erro) => logError("atendente-uso", erro, p.companyId));

  if (fatos.configuracaoDivergente) {
    try {
      await persistir(estadoAnterior ?? Prisma.DbNull,
        "O cadastro foi alterado em outra área. Importe e revise a configuração da Nexa antes de reativar esta conversa.", true);
      await liberarExecucao();
    } catch (erro) {
      await logError("atendente-configuracao-divergente", erro, p.companyId);
      await revisarExecucao("os dados do cadastro divergem da configuração publicada")
        .catch((falha) => logError("atendente-revisao", falha, p.companyId));
    }
    return silencio("EQUIPE_NA_CONVERSA");
  }

  if (plano.acao === "AVISO_DO_TETO") {
    const motivo = `Chegou depois das ${TETO_CONVERSAS_MES} conversas do mês: responda por você`;
    const impedimento = await conferir();
    if (impedimento) { await liberarExecucao(); return silencio(impedimento); }
    const textos = [t.teto({ apresentacao: apresentacao({ nome: fatos.nome, empresa: fatos.empresa }), volta })];
    try { await persistir(Prisma.DbNull, motivo, true, textos); }
    catch (erro) { return tratarFalhaDeRegistro(erro, true); }
    const envio = await enviarESalvar(textos);
    // Zero respostas: o aviso não conta como conversa do mês, mas marca o dia.
    await registro({ respostas: 0, precisaDoDono: true, motivo });
    return envio;
  }

  if (plano.acao === "AVISO_DO_LIMITE") {
    const motivo = "Conversa longa: continue por você";
    const impedimento = await conferir();
    if (impedimento) { await liberarExecucao(); return silencio(impedimento); }
    const textos = [t.limiteDoDia(volta)];
    try { await persistir(Prisma.DbNull, motivo, true, textos); }
    catch (erro) { return tratarFalhaDeRegistro(erro, true); }
    const envio = await enviarESalvar(textos);
    await registro({ respostas: envio.acao === "RESPONDEU" ? 1 : 0, precisaDoDono: true, motivo });
    return envio;
  }

  const nomeDaAgenda = nomeParaAgenda(conversa.customerName);
  const saida = await responder(
    {
      texto: plano.texto,
      historico: mensagens
        .filter((m) => m.role !== "SYSTEM")
        .map((m) => ({ role: m.role, content: m.content })),
      estado: lerEstado(conversa.atendenteEstado, agora),
      primeiraDoDia: plano.primeiraDoDia,
      clienteNome,
      telefone: conversa.customerPhone,
      fatos,
      agora,
      contexto: plano.contexto,
      palavrasDoDono: lerPalavrasDoDono(perfil.handoffKeywords),
    },
    {
      livres: (q) =>
        horariosLivres({
          companyId: p.companyId,
          duracaoMin: q.servico.duracaoMin,
          dias: q.dias,
          agora,
          profissional: q.profissional,
        }),
      marcar: (q) =>
        marcarNaAgenda({
          companyId: p.companyId,
          servico: q.servico,
          inicio: q.inicio,
          profissional: q.profissional,
          cliente: { nome: nomeDaAgenda ?? q.cliente.nome, telefone: q.cliente.telefone },
          origem: "ATENDENTE",
          chaveOperacao: `${p.companyId}:${conversa.id}:${ultima.id}`,
          agora,
        }),
      ia: ({ systemPrompt, historico }) => generateReceptionistReply({ systemPrompt, history: historico }),
    },
  );

  execucao = { ...execucao, proposta: {
    estado: saida.estado ? saida.estado as Prisma.InputJsonValue : null,
    mensagens: saida.mensagens,
    ...(saida.marcou ? { reserva: { appointmentId: saida.marcou.appointmentId,
      servico: saida.marcou.servico, inicio: saida.marcou.inicio.toISOString() } } : {}),
  } };

  // Uma reserva confirmada permanece na agenda se o dono assumiu no caminho.
  // Sua confirmação automática também respeita a intervenção humana.
  let impedimento = await conferir();
  let registroPersistido = false;
  if (!impedimento) {
    try {
      await persistir(saida.estado ? (saida.estado as Prisma.InputJsonValue) : Prisma.DbNull,
        saida.anotar?.motivo, Boolean(saida.equipe), saida.mensagens, saida.marcou);
      registroPersistido = true;
    } catch (erro) {
      if (!saida.marcou) return tratarFalhaDeRegistro(erro, Boolean(saida.equipe),
        saida.urgente || (saida.equipe && saida.estado?.tipo === "HORARIO") ? saida.mensagens : []);
      // A confirmação da agenda continua válida mesmo que o acompanhamento
      // da conversa falhe. Nunca se descreve essa reserva como não concluída.
      if (erro instanceof AtendimentoInterrompido) impedimento = "EQUIPE_NA_CONVERSA";
      else {
        await logError("atendente-registro-apos-reserva", erro, p.companyId);
        const revisada = await revisarExecucao("a reserva foi confirmada, mas o acompanhamento da conversa falhou")
          .catch(async (falha) => { await logError("atendente-revisao", falha, p.companyId); return false; });
        if (revisada) encaminhamentoPersistido = true;
        else impedimento = "EQUIPE_NA_CONVERSA";
      }
    }
  }
  if (impedimento) {
    if (saida.marcou || (saida.equipe && saida.estado?.tipo === "HORARIO")) {
      await revisarExecucao("a conversa mudou durante a reserva; conferir o resultado antes de responder");
    } else await liberarExecucao();
    if (!saida.marcou) return silencio(impedimento);
  }

  const envio = impedimento ? silencio(impedimento) : await enviarESalvar(saida.mensagens);

  await registro({
    respostas: envio.acao === "RESPONDEU" ? 1 : 0,
    marcados: saida.marcou && !saida.marcou.reutilizada ? 1 : 0,
    valorMarcadoCents: saida.marcou && !saida.marcou.reutilizada ? saida.marcou.valorCents : 0,
    precisaDoDono: Boolean(saida.anotar) || Boolean(impedimento && saida.marcou),
    motivo: saida.anotar?.motivo,
    urgente: saida.urgente,
  });

  if (saida.anotar && registroPersistido && !impedimento) {
    // Só pergunta vira lacuna: pedido de pessoa ou reclamação não é falta de conhecimento.
    if (saida.anotar.pergunta) {
      await recordKnowledgeGap(p.companyId, saida.anotar.pergunta, saida.anotar.motivo)
        .catch((erro) => logError("atendente-lacuna", erro, p.companyId));
      await consultarDonoSobreDuvida({
        companyId: p.companyId,
        instance,
        pergunta: saida.anotar.pergunta,
        cliente: clienteNome,
        telefone: conversa.customerPhone,
      }).catch((erro) => logError("atendente-consultar-dono", erro, p.companyId));
    }
  }

  if (saida.marcou) {
    // Quem recebeu a Onda e marcou com o Atendente: o contato da Onda vira "marcou".
    if (saida.marcou.clienteId) {
      await prisma.recoveryTouch.updateMany({
        where: {
          companyId: p.companyId,
          customerId: saida.marcou.clienteId,
          outcome: "AGUARDANDO",
          sentAt: { gte: new Date(agora.getTime() - JANELA_DIAS * DIA_MS) },
        },
        data: { outcome: "MARCOU", outcomeAt: agora },
      }).catch((erro) => logError("atendente-atribuicao", erro, p.companyId));
    }
    await prisma.lead.upsert({
      where: { conversationId: conversa.id },
      create: {
        companyId: p.companyId,
        conversationId: conversa.id,
        name: nomeDaAgenda ?? clienteNome ?? "Cliente",
        phone: conversa.customerPhone,
        interest: saida.marcou.servico,
      },
      update: { interest: saida.marcou.servico, ...(nomeDaAgenda ? { name: nomeDaAgenda } : {}) },
    }).catch((erro) => logError("atendente-lead", erro, p.companyId));
  }

  if (saida.urgente) {
    await avisarDono({
      companyId: p.companyId,
      instance,
      conversationId: conversa.id,
      cliente: clienteNome,
      telefone: conversa.customerPhone,
      trecho: plano.texto.replace(/\s+/g, " ").slice(0, MAX_TRECHO),
    }).catch((erro) => logError("atendente-urgencia", erro, p.companyId));
  }

  return envio;
}

/**
 * Urgência: o dono fica sabendo no WhatsApp dele — mensagem para o número do
 * cadastro, pela própria conexão — e por e-mail. Falha num canal não impede o
 * outro, e nenhuma falha aqui desfaz a orientação que o cliente já recebeu.
 */
async function avisarDono(p: {
  companyId: string;
  instance: string;
  conversationId: string;
  cliente: string | null;
  telefone: string;
  trecho: string;
}): Promise<void> {
  const empresa = await prisma.company.findUnique({
    where: { id: p.companyId },
    select: { phone: true, email: true },
  });
  const texto = avisoDeUrgencia({ cliente: p.cliente, telefone: p.telefone, trecho: p.trecho });

  const numero = numeroDoDono(empresa?.phone);
  if (numero && numero !== p.telefone) {
    await enviarWhatsApp(p.instance, numero, texto).catch((erro) => logError("atendente-urgencia", erro, p.companyId));
  }

  if (empresa?.email) {
    await enviarEmail(empresa.email, {
      assunto: `Urgência no WhatsApp: ${p.cliente ?? telefoneFalado(p.telefone)}`,
      corpo: `${texto}\n\nA conversa está no seu painel, aguardando você.`,
      acao: { texto: "Abrir a conversa", href: `/painel/conversas/${p.conversationId}` },
    }).catch((erro) => logError("atendente-urgencia-email", erro, p.companyId));
  }
}

/**
 * Dúvida que o atendente não soube responder: consulta o dono pelo WhatsApp dele
 * para pedir que o ensine a responder.
 */
async function consultarDonoSobreDuvida(p: {
  companyId: string;
  instance: string;
  pergunta: string;
  cliente: string | null;
  telefone: string;
}): Promise<void> {
  const empresa = await prisma.company.findUnique({
    where: { id: p.companyId },
    select: { name: true, phone: true, email: true },
  });
  const numero = numeroDoDono(empresa?.phone);
  if (numero && numero !== p.telefone) {
    const quemPerguntou = p.cliente ? `O cliente ${p.cliente}` : "Um cliente";
    const texto =
      `Oi! ${quemPerguntou} acabou de me perguntar algo que eu ainda não sei responder:\n\n` +
      `"${p.pergunta}"\n\n` +
      `Você poderia me ensinar como responder isso? É só acessar o seu painel do Atendente para me ensinar!`;
    await enviarWhatsApp(p.instance, numero, texto).catch((erro) =>
      logError("atendente-consultar-dono", erro, p.companyId),
    );
  }

  if (empresa?.email) {
    await enviarEmail(empresa.email, {
      assunto: "Dúvida no WhatsApp: me ensina como responder?",
      corpo: `Um cliente (${p.cliente ?? telefoneFalado(p.telefone)}) perguntou:\n\n"${p.pergunta}"\n\nVocê pode me ensinar direto pelo seu painel para eu já aprender.`,
      acao: { texto: "Ensinar Atendente", href: "/painel/atendente" },
    }).catch((erro) => logError("atendente-consultar-dono-email", erro, p.companyId));
  }
}

