import { horarioDaEmpresa, lerDiasFechados } from "@/lib/agenda/horario";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { telefoneFalado } from "@/lib/recuperacao/telefone";
import { enviarEmail, type Mensagem } from "@/lib/reengajamento/email";
import { tokenDescadastro } from "@/lib/reengajamento/servico";
import type { BusinessHour } from "@/lib/validation";
import { problemaNoGateway } from "@/lib/whatsapp/endereco";
import { instanciaInexistente, servidorFora } from "@/lib/whatsapp/envio";
import {
  CARENCIA_DO_RESGATE_MS,
  IDADE_MAXIMA_DO_RESGATE_MS,
  INTERVALO_DO_RESGATE_MS,
  MINUTOS_SEM_RESPOSTA,
} from "./constantes";
import { localDe, ultimoFechamento } from "./datas";
import { atender } from "./executar";
import { precoFalado } from "./fatos";
import { cumprimento } from "./jeitos";
import { lojaFechada } from "./portao";

/**
 * O RESGATE DE CADA MINUTO E O RESUMO DA MANHÃ.
 *
 * No expediente, a mensagem que chega é do dono. Se ninguém responder em 5
 * minutos, é aqui que o Atendente entra — pela mesma porta do webhook
 * (`atender`), que confere tudo de novo antes de mandar. Com a loja fechada,
 * quem responde é o webhook, na hora; o resgate só pega o que ficou para trás
 * (servidor reiniciado no meio, por exemplo), passada a carência.
 *
 * O Atendente nunca começa conversa: o resgate só responde mensagem de cliente
 * que ficou sem resposta — nunca manda lembrete para quem sumiu.
 *
 * Na abertura, o dono recebe por e-mail o que aconteceu enquanto estava
 * fechado, uma vez por dia (`atendenteResumoDia` é a reivindicação).
 */

export type Candidata = {
  id: string;
  status: string;
  donoAssumiuEm: Date | null;
  ultimaDoClienteEm: Date | null;
  /** O papel da última mensagem que não é anotação do sistema. */
  ultimaRole: string | null;
};

/** Quem ficou sem resposta e já pode ser atendido pelo resgate. */
export function pendentesParaResgate(candidatas: Candidata[], p: { agora: Date; fechada: boolean }): string[] {
  const minimo = p.fechada ? CARENCIA_DO_RESGATE_MS : MINUTOS_SEM_RESPOSTA * 60_000;
  return candidatas
    .filter((c) => {
      if (c.status === "HUMAN" || c.ultimaRole !== "CUSTOMER" || !c.ultimaDoClienteEm) return false;
      // O dono respondeu pelo celular depois da mensagem: a conversa é dele.
      if (c.donoAssumiuEm && c.donoAssumiuEm.getTime() >= c.ultimaDoClienteEm.getTime()) return false;
      const idade = p.agora.getTime() - c.ultimaDoClienteEm.getTime();
      return idade >= minimo && idade <= IDADE_MAXIMA_DO_RESGATE_MS;
    })
    .map((c) => c.id);
}

export type AtendimentoDoResumo = {
  clienteNome: string | null;
  clienteTelefone: string;
  respostas: number;
  marcados: number;
  valorMarcadoCents: number;
  precisaDoDono: boolean;
  motivo: string;
  urgente: boolean;
  resolvidoEm: Date | null;
};

/** O e-mail fica curto: o resto está no painel. */
const MAX_PENDENCIAS_NO_EMAIL = 10;

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** O e-mail da abertura. null quando não há nada para contar. */
export function resumoDaManha(p: { nome: string; atendimentos: AtendimentoDoResumo[]; agora: Date }): Mensagem | null {
  // O aviso de teto grava zero respostas: não é conversa atendida, mas pode
  // precisar do dono.
  const conversas = p.atendimentos.filter((a) => a.respostas > 0).length;
  const marcados = p.atendimentos.reduce((soma, a) => soma + a.marcados, 0);
  const valor = p.atendimentos.reduce((soma, a) => soma + a.valorMarcadoCents, 0);
  const pendentes = p.atendimentos
    .filter((a) => a.precisaDoDono && !a.resolvidoEm)
    .sort((a, b) => Number(b.urgente) - Number(a.urgente));
  if (conversas === 0 && pendentes.length === 0) return null;

  const quem = p.nome.trim() || "o Atendente Virtual";
  const marcou =
    marcados > 0
      ? ` e marcou ${plural(marcados, "horário", "horários")}${valor > 0 ? ` (${precoFalado(valor)} em atendimentos marcados)` : ""}`
      : "";
  const abertura = `${cumprimento(p.agora)}! Enquanto você estava fechado, ${quem} atendeu ${plural(conversas, "conversa", "conversas")}${marcou}.`;

  const linhas = pendentes
    .slice(0, MAX_PENDENCIAS_NO_EMAIL)
    .map((a) => `• ${a.urgente ? "Urgente — " : ""}${a.clienteNome ?? telefoneFalado(a.clienteTelefone)}: ${a.motivo}`);
  if (pendentes.length > MAX_PENDENCIAS_NO_EMAIL) {
    linhas.push(`• e mais ${pendentes.length - MAX_PENDENCIAS_NO_EMAIL} no painel`);
  }
  const lista = linhas.length ? `Precisa de você:\n${linhas.join("\n")}` : "Nada ficou esperando por você.";

  return {
    assunto: `Enquanto você estava fechado: ${plural(conversas, "conversa", "conversas")}${
      marcados > 0 ? `, ${plural(marcados, "horário marcado", "horários marcados")}` : ""
    }`,
    corpo: `${abertura}\n\n${lista}`,
    acao: { texto: "Abrir o Atendente Virtual", href: "/painel/atendente" },
  };
}

async function resumirAManha(p: {
  companyId: string;
  nome: string;
  horarios: BusinessHour[];
  diasFechados: string[];
  agora: Date;
}): Promise<void> {
  const hoje = localDe(p.agora).data;
  // A reivindicação: só uma rodada manda o resumo do dia.
  const { count } = await prisma.companyProfile.updateMany({
    where: { companyId: p.companyId, atendenteResumoDia: { not: hoje } },
    data: { atendenteResumoDia: hoje },
  });
  if (count === 0) return;

  const desde = ultimoFechamento(p.horarios, p.diasFechados, p.agora);
  if (!desde) return;

  const empresa = await prisma.company.findUnique({
    where: { id: p.companyId },
    select: { email: true, semEmail: true },
  });
  // Pediu para não receber e-mail da Nexora: o resumo fica só no painel.
  if (!empresa?.email || empresa.semEmail) return;

  const atendimentos = await prisma.atendenteAtendimento.findMany({
    where: { companyId: p.companyId, foraDoHorario: true, atualizadoEm: { gte: desde } },
    select: {
      clienteNome: true,
      clienteTelefone: true,
      respostas: true,
      marcados: true,
      valorMarcadoCents: true,
      precisaDoDono: true,
      motivo: true,
      urgente: true,
      resolvidoEm: true,
    },
    orderBy: { criadoEm: "asc" },
    take: 200,
  });

  const mensagem = resumoDaManha({ nome: p.nome, atendimentos, agora: p.agora });
  if (!mensagem) return;
  // É e-mail de relacionamento: leva o mesmo descadastro assinado da régua, e
  // quem clica deixa de receber também este resumo (semEmail, acima).
  const appUrl = (process.env.APP_URL ?? "").replace(/\/+$/, "");
  const descadastro = `${appUrl}/descadastro?e=${p.companyId}&t=${tokenDescadastro(p.companyId)}`;
  await enviarEmail(empresa.email, mensagem, descadastro);
}

/** Tetos de uma rodada: o que passar fica para a próxima, um minuto depois. */
const MAX_EMPRESAS_POR_RODADA = 500;
const MAX_CONVERSAS_POR_EMPRESA = 20;

type EstadoDoResgate = { rodando?: boolean; avisado?: boolean; quedaRegistrada?: boolean; iniciado?: boolean };
// No globalThis, e não no módulo: o recarregamento do Next em desenvolvimento
// reavalia o módulo, e o estado de uma rodada em andamento não pode se perder.
const memoria = globalThis as unknown as { __resgateDoAtendente?: EstadoDoResgate };
const estadoDoResgate = (): EstadoDoResgate => (memoria.__resgateDoAtendente ??= {});

/**
 * O WhatsApp tem para onde enviar? Checado uma vez por rodada, antes do laço:
 * o problema é de configuração, vale para todas as conversas, e o aviso sai
 * uma vez por processo — e não uma linha de log por conversa a cada minuto.
 */
function gatewayIndisponivel(): string | null {
  if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) {
    return "EVOLUTION_API_URL / EVOLUTION_API_KEY não configurados";
  }
  return problemaNoGateway(process.env.EVOLUTION_API_URL, process.env.NODE_ENV);
}

export async function rodadaDoResgate(agora: Date = new Date()): Promise<{ respondidas: number }> {
  const estado = estadoDoResgate();
  // Uma rodada por vez: se a anterior ainda responde, duas responderiam juntas.
  if (estado.rodando) return { respondidas: 0 };

  const problema = gatewayIndisponivel();
  if (problema) {
    if (!estado.avisado) {
      estado.avisado = true;
      console.warn(`[atendente] resgate parado até o WhatsApp ter um servidor fixo: ${problema}`);
    }
    return { respondidas: 0 };
  }

  estado.rodando = true;
  try {
    return await rodar(agora, estado);
  } finally {
    estado.rodando = false;
  }
}

async function rodar(agora: Date, estado: EstadoDoResgate): Promise<{ respondidas: number }> {
  let respondidas = 0;
  const hoje = localDe(agora).data;

  const perfis = await prisma.companyProfile.findMany({
    where: { plantaoAtivo: true, whatsappInstance: { not: null }, whatsappStatus: "CONNECTED" },
    select: {
      companyId: true,
      atendenteExpediente: true,
      atendenteNome: true,
      businessHours: true,
      diasFechados: true,
      atendenteResumoDia: true,
    },
    orderBy: { companyId: "asc" },
    take: MAX_EMPRESAS_POR_RODADA,
  });

  for (const perfil of perfis) {
    const horarios = horarioDaEmpresa(perfil.businessHours);
    const diasFechados = lerDiasFechados(perfil.diasFechados);
    const fechada = lojaFechada({ horarios, diasFechados, agora });

    if (!fechada && perfil.atendenteResumoDia !== hoje) {
      await resumirAManha({ companyId: perfil.companyId, nome: perfil.atendenteNome, horarios, diasFechados, agora }).catch(
        (erro) => logError("atendente-resumo", erro, perfil.companyId),
      );
    }

    // Sem a opção do expediente, a loja aberta é só do dono.
    if (!fechada && !perfil.atendenteExpediente) continue;

    const minimo = fechada ? CARENCIA_DO_RESGATE_MS : MINUTOS_SEM_RESPOSTA * 60_000;
    const conversas = await prisma.conversation.findMany({
      where: {
        companyId: perfil.companyId,
        status: { not: "HUMAN" },
        lastCustomerMessageAt: {
          gte: new Date(agora.getTime() - IDADE_MAXIMA_DO_RESGATE_MS),
          lte: new Date(agora.getTime() - minimo),
        },
      },
      select: {
        id: true,
        status: true,
        donoAssumiuEm: true,
        lastCustomerMessageAt: true,
        messages: {
          where: { role: { not: "SYSTEM" } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { role: true },
        },
      },
      orderBy: { lastCustomerMessageAt: "asc" },
      take: MAX_CONVERSAS_POR_EMPRESA,
    });

    const pendentes = pendentesParaResgate(
      conversas.map((c) => ({
        id: c.id,
        status: c.status,
        donoAssumiuEm: c.donoAssumiuEm,
        ultimaDoClienteEm: c.lastCustomerMessageAt,
        ultimaRole: c.messages[0]?.role ?? null,
      })),
      { agora, fechada },
    );

    for (const conversationId of pendentes) {
      try {
        const resultado = await atender({ companyId: perfil.companyId, conversationId, origem: "RESGATE", agora });
        if (resultado.acao === "RESPONDEU") respondidas += 1;
        // O servidor respondeu: a próxima queda volta a merecer registro.
        estado.quedaRegistrada = false;
      } catch (erro) {
        // A conexão desta empresa sumiu do servidor: vale para todas as
        // conversas dela. O envio já marcou o WhatsApp como não ligado.
        if (instanciaInexistente(erro)) break;
        if (servidorFora(erro)) {
          // Falha do servidor vale para todas as conversas: tentar a próxima só
          // repete o erro. Registra uma vez por sequência de quedas e encerra.
          if (!estado.quedaRegistrada) {
            estado.quedaRegistrada = true;
            await logError("atendente-resgate", erro, perfil.companyId);
          }
          return { respondidas };
        }
        await logError("atendente-resgate", erro, perfil.companyId);
      }
    }
  }

  return { respondidas };
}

/** Liga o resgate no boot do servidor (instrumentation.ts). */
export function iniciarResgate(): void {
  const estado = estadoDoResgate();
  if (estado.iniciado) return;
  estado.iniciado = true;
  console.log("[atendente] resgate ativo (a cada minuto)");
  setInterval(() => {
    rodadaDoResgate().catch((erro) => console.error("[atendente] rodada do resgate falhou", erro));
  }, INTERVALO_DO_RESGATE_MS);
}
