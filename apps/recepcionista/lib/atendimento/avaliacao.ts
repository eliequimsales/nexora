import { Prisma } from "@nexora/recepcionista-prisma";
import { prisma } from "@/lib/db";
import { avaliacaoAtendimentoSchema, resumirResultados, type ResultadoAtendimento } from "./avaliacao-schema";

export class AvaliacaoErro extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "AvaliacaoErro"; }
}

const papeis = ["CUSTOMER", "AI", "HUMAN"] as const;
const mensagensAtuais = { where: { role: { in: [...papeis] } }, orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }], take: 1, select: { id: true, createdAt: true } };

export async function getResumoResultados(companyId: string, since: Date) {
  const conversations = await prisma.conversation.findMany({
    where: { companyId, createdAt: { gte: since } },
    select: {
      messages: mensagensAtuais,
      evaluations: { where: { companyId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { outcome: true, source: true, anchorMessageId: true } },
    },
  });
  return resumirResultados(conversations);
}

export async function getAvaliacaoAtendimento(companyId: string, conversationId: string) {
  const conversa = await prisma.conversation.findFirst({
    where: { id: conversationId, companyId },
    select: { id: true, messages: mensagensAtuais, evaluations: { where: { companyId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 } },
  });
  if (!conversa) throw new AvaliacaoErro("Conversa não encontrada.", 404);
  const evaluation = conversa.evaluations[0] ?? null;
  const lastMessageId = conversa.messages[0]?.id ?? null;
  return {
    evaluation: evaluation ? { id: evaluation.id, outcome: evaluation.outcome as ResultadoAtendimento, note: evaluation.note, source: evaluation.source, createdAt: evaluation.createdAt, current: evaluation.anchorMessageId === lastMessageId } : null,
    lastMessageId,
  };
}

/** A avaliação descreve o que aconteceu; não envia mensagens, assume o chat ou ensina uma política. */
export async function avaliarAtendimento(companyId: string, conversationId: string, entrada: unknown) {
  const input = avaliacaoAtendimentoSchema.parse(entrada);
  try {
    return await prisma.$transaction(async (db) => {
      const anterior = await db.conversationEvaluation.findUnique({ where: { companyId_requestId: { companyId, requestId: input.requestId } } });
      if (anterior) {
        if (anterior.conversationId !== conversationId || anterior.anchorMessageId !== input.lastMessageId || anterior.outcome !== input.outcome || anterior.note !== input.note) throw new AvaliacaoErro("Esta tentativa já foi usada com outra avaliação. Recarregue antes de avaliar.", 409);
        return { id: anterior.id, outcome: anterior.outcome };
      }
      const conversa = await db.conversation.findFirst({
        where: { id: conversationId, companyId },
        select: { id: true, status: true, messages: { where: { role: { in: [...papeis] } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, select: { id: true, role: true, content: true, createdAt: true } } },
      });
      if (!conversa) throw new AvaliacaoErro("Conversa não encontrada.", 404);
      const anchor = conversa.messages[0];
      if (!anchor || anchor.id !== input.lastMessageId) throw new AvaliacaoErro("Chegaram novas mensagens. Leia a conversa atualizada antes de avaliar.", 409);
      if (input.outcome === "RESOLVIDO_ATENDENTE") {
        const [ai, humano] = await Promise.all([
          db.message.findFirst({ where: { conversationId, role: "AI" }, select: { id: true } }),
          db.message.findFirst({ where: { conversationId, role: "HUMAN" }, select: { id: true } }),
        ]);
        if (!ai) throw new AvaliacaoErro("Esta conversa ainda não tem resposta registrada do atendente.", 400);
        if (humano || conversa.status === "HUMAN" || conversa.status === "WAITING_HUMAN") throw new AvaliacaoErro("Houve participação ou solicitação da equipe. Avalie o resultado com intervenção humana.", 400);
      }
      const profile = await db.companyProfile.findUnique({ where: { companyId }, select: { atendenteConfiguracao: true } });
      const envelope = profile?.atendenteConfiguracao;
      const publicado = envelope && typeof envelope === "object" && !Array.isArray(envelope) ? envelope.publicado : null;
      const revisao = publicado && typeof publicado === "object" && !Array.isArray(publicado) && typeof publicado.revisao === "number" ? publicado.revisao : null;
      const evaluation = await db.conversationEvaluation.create({ data: {
        companyId, conversationId, requestId: input.requestId, outcome: input.outcome, source: "OWNER", note: input.note,
        anchorMessageId: anchor.id, anchorAt: anchor.createdAt,
        context: { status: conversa.status, publishedRevision: revisao, messages: [...conversa.messages].reverse().map(m => ({ id: m.id, role: m.role, content: m.content.slice(0, 1500), at: m.createdAt.toISOString() })) },
      } });
      if (input.outcome === "PRECISA_CORRIGIR") {
        const pergunta = conversa.messages.find(m => m.role === "CUSTOMER")?.content.trim().slice(0, 300);
        if (pergunta && pergunta.length >= 4) {
          const questionKey = pergunta.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
          if (questionKey.length >= 4) await db.knowledgeGap.upsert({
            where: { companyId_questionKey: { companyId, questionKey } },
            create: { companyId, questionKey, question: pergunta, source: "CUSTOMER", reason: "Avaliação do responsável: " + input.note.slice(0, 170) },
            update: { status: "OPEN", askCount: { increment: 1 }, lastAskedAt: new Date(), reason: "Avaliação do responsável: " + input.note.slice(0, 170) },
          });
        }
      }
      return { id: evaluation.id, outcome: evaluation.outcome };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) {
    if (e instanceof AvaliacaoErro) throw e;
    if (["P2002", "P2034"].includes((e as { code?: string }).code ?? "")) throw new AvaliacaoErro("A conversa ou a avaliação mudou. Recarregue antes de continuar.", 409);
    throw e;
  }
}
