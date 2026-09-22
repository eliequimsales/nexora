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
import { atrasoDeDigitacao, enviarWhatsApp } from "@/lib/whatsapp/envio";
import { ESPERA_DA_RAJADA_MS, JANELA_DO_DONO_MS, MAX_RESPOSTAS_POR_DIA, TETO_CONVERSAS_MES } from "./constantes";
import { localDe, proximaAbertura, textoDaVolta } from "./datas";
import { fatosDaEmpresa, lerPalavrasDoDono } from "./fatos";
import { apresentacao, primeiroNomeDoCliente, textosDoJeito } from "./jeitos";
import { responder, type Contexto } from "./motor";
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
 *   5. Envio com "digitando…", mensagem salva, estado da conversa, atendimento
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
  if (p.statusDaConversa === "HUMAN") return silencio("EQUIPE_NA_CONVERSA");

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
    "O Atendente orientou a procurar o 192 (ou o 188, se for risco à própria vida) e saiu da conversa. " +
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

  const [perfil, conversa, recentes] = await Promise.all([
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
      },
    }),
    prisma.message.findMany({
      where: { conversationId: p.conversationId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, role: true, content: true, createdAt: true },
    }),
  ]);
  if (!perfil || !conversa) return silencio("SEM_CONVERSA");
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
  if (plano.acao === "SILENCIO" || plano.acao === "ESPERAR") return plano;

  const instance = perfil.whatsappInstance!;
  const pendentes = semResposta(mensagens);
  const ultima = pendentes[pendentes.length - 1];

  /** Ainda é a vez do Atendente? A equipe, o dono ou uma mensagem nova podem ter chegado. */
  async function conferir(): Promise<MotivoDoSilencio | null> {
    const [atual, maisNova] = await Promise.all([
      prisma.conversation.findFirst({
        where: { id: conversa!.id, companyId: p.companyId },
        select: { status: true, donoAssumiuEm: true },
      }),
      prisma.message.findFirst({
        where: { conversationId: conversa!.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, role: true },
      }),
    ]);
    if (!atual || atual.status === "HUMAN") return "EQUIPE_NA_CONVERSA";
    if (atual.donoAssumiuEm && agora.getTime() - atual.donoAssumiuEm.getTime() < JANELA_DO_DONO_MS) {
      return "DONO_ASSUMIU";
    }
    if (maisNova && maisNova.id !== ultima.id) return maisNova.role === "CUSTOMER" ? "RAJADA" : "JA_RESPONDIDA";
    return null;
  }

  if (p.origem === "WEBHOOK") {
    await deps.esperar(ESPERA_DA_RAJADA_MS);
    const motivo = await conferir();
    if (motivo) return silencio(motivo);
  }

  const fatos = await fatosDaEmpresa(p.companyId);
  const t = textosDoJeito(fatos.jeito);
  const fechada = lojaFechada({ horarios: fatos.horarios, diasFechados: fatos.diasFechados, agora });
  const volta = fechada ? textoDaVolta(proximaAbertura(fatos.horarios, fatos.diasFechados, agora), agora) : null;
  const clienteNome = primeiroNomeDoCliente(conversa.customerName);

  async function enviarESalvar(textos: string[]): Promise<void> {
    for (const texto of textos) {
      await enviarWhatsApp(instance, conversa!.customerPhone, texto, { atrasoMs: atrasoDeDigitacao(texto) });
      await prisma.message.create({ data: { conversationId: conversa!.id, role: "AI", content: texto } });
    }
  }

  async function anotarNaConversa(motivo: string): Promise<void> {
    await prisma.message.create({
      data: { conversationId: conversa!.id, role: "SYSTEM", content: `Anotado para você: ${motivo}` },
    });
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
    });

  if (plano.acao === "AVISO_DO_TETO") {
    const motivo = `Chegou depois das ${TETO_CONVERSAS_MES} conversas do mês: responda por você`;
    await enviarESalvar([t.teto({ apresentacao: apresentacao({ nome: fatos.nome, empresa: fatos.empresa }), volta })]);
    // Zero respostas: o aviso não conta como conversa do mês, mas marca o dia.
    await registro({ respostas: 0, precisaDoDono: true, motivo });
    await anotarNaConversa(motivo);
    return { acao: "RESPONDEU", mensagens: 1 };
  }

  if (plano.acao === "AVISO_DO_LIMITE") {
    const motivo = "Conversa longa: continue por você";
    await enviarESalvar([t.limiteDoDia(volta)]);
    await registro({ respostas: 1, precisaDoDono: true, motivo });
    await anotarNaConversa(motivo);
    return { acao: "RESPONDEU", mensagens: 1 };
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
          agora,
        }),
      ia: ({ systemPrompt, historico }) => generateReceptionistReply({ systemPrompt, history: historico }),
    },
  );

  // Com a marcação feita, a confirmação sai de qualquer jeito: o cliente
  // precisa saber que o horário é dele.
  if (!saida.marcou) {
    const motivo = await conferir();
    if (motivo) return silencio(motivo);
  }

  await enviarESalvar(saida.mensagens);

  await prisma.conversation.update({
    where: { id: conversa.id },
    data: {
      atendenteEstado: saida.estado ? (saida.estado as Prisma.InputJsonValue) : Prisma.DbNull,
      // Pessoa, reclamação ou urgência: a conversa passa para a equipe, e o
      // Atendente fica fora dela pelas mesmas 12 horas de quando o dono
      // responde pelo celular. "Reativar" no painel devolve na hora.
      ...(saida.equipe ? { status: "WAITING_HUMAN" as const, donoAssumiuEm: agora } : {}),
    },
  });

  await registro({
    respostas: 1,
    marcados: saida.marcou ? 1 : 0,
    valorMarcadoCents: saida.marcou?.valorCents ?? 0,
    precisaDoDono: Boolean(saida.anotar),
    motivo: saida.anotar?.motivo,
    urgente: saida.urgente,
  });

  if (saida.anotar) {
    await anotarNaConversa(saida.anotar.motivo);
    // Só pergunta vira lacuna: pedido de pessoa ou reclamação não é falta de conhecimento.
    if (saida.anotar.pergunta) await recordKnowledgeGap(p.companyId, saida.anotar.pergunta, saida.anotar.motivo);
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
      });
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
    });
  }

  if (saida.urgente) {
    await avisarDono({
      companyId: p.companyId,
      instance,
      conversationId: conversa.id,
      cliente: clienteNome,
      telefone: conversa.customerPhone,
      trecho: plano.texto.replace(/\s+/g, " ").slice(0, MAX_TRECHO),
    });
  }

  return { acao: "RESPONDEU", mensagens: saida.mensagens.length };
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
