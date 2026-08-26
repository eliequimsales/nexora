import type { CompanyProfile, KnowledgeItem } from "@nexora/recepcionista-prisma";
import { prisma } from "./db";
import { logError } from "./errors";
import { structureTrainedAnswer } from "./ai/provider";
import { getTemplatesForSegments, type SegmentTopic } from "./segments";

/** Lê o Json de áreas de atuação com segurança. */
export function asSegments(value: unknown): string[] {
  return Array.isArray(value)
    ? (value as unknown[]).filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];
}
import type { BusinessHour, Faq } from "./validation";

/**
 * NALS — Treinamento do Atendente.
 *
 * Filosofia: o Atendente trabalha, observa e registra lacunas em silêncio.
 * Ele NUNCA aprende sozinho: todo conhecimento novo passa pela empresa
 * (responder → revisar → aprovar) antes de ser usado em qualquer resposta.
 */

// ——— Funções puras (testáveis) ———

/** Chave normalizada para deduplicar variações da mesma dúvida. */
export function normalizeQuestionKey(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

export interface KnowledgeArea {
  label: string;
  pct: number;
}

export interface KnowledgeScore {
  overall: number;
  areas: KnowledgeArea[];
  openGaps: number;
}

/**
 * Indicador "Conhecimento do Atendente": mostra onde a empresa deve investir
 * poucos minutos de treinamento. Determinístico, calculado do cadastro +
 * itens aprovados − lacunas em aberto.
 */
export function computeKnowledgeScore(
  profile: Pick<
    CompanyProfile,
    "description" | "address" | "productsServices" | "pricingInfo" | "paymentMethods" | "serviceRules"
  > & { businessHours: unknown; faqs: unknown },
  approvedCount: number,
  openGaps: number,
): KnowledgeScore {
  const hours = Array.isArray(profile.businessHours) ? (profile.businessHours as BusinessHour[]) : [];
  const faqs = Array.isArray(profile.faqs) ? (profile.faqs as Faq[]) : [];

  const areas: KnowledgeArea[] = [
    { label: "Sobre a empresa", pct: profile.description.trim() ? 100 : 0 },
    { label: "Horários", pct: hours.length > 0 ? 100 : 0 },
    { label: "Endereço", pct: profile.address.trim() ? 100 : 0 },
    { label: "Produtos e serviços", pct: profile.productsServices.trim() ? 100 : 0 },
    { label: "Preços", pct: profile.pricingInfo.trim() ? 100 : 0 },
    { label: "Pagamentos", pct: profile.paymentMethods.trim() ? 100 : 0 },
    { label: "Regras de atendimento", pct: profile.serviceRules.trim() ? 100 : 0 },
    {
      label: "Dúvidas treinadas",
      pct: faqs.length + approvedCount >= 5 ? 100 : Math.round(((faqs.length + approvedCount) / 5) * 100),
    },
  ];

  const base = Math.round(areas.reduce((sum, a) => sum + a.pct, 0) / areas.length);
  const penalty = Math.min(25, openGaps * 3); // cada dúvida em aberto pesa
  return { overall: Math.max(0, base - penalty), areas, openGaps };
}

export interface InconsistencyGroup {
  question: string;
  options: { id: string; answer: string }[];
}

/**
 * Respostas diferentes da equipe para a MESMA pergunta — nunca alteram a base;
 * viram uma escolha na reunião: "Qual delas está correta?" (puro, testável)
 */
export function findInconsistencies(
  items: { id: string; question: string; answer: string }[],
): InconsistencyGroup[] {
  const byKey = new Map<string, { id: string; question: string; answer: string }[]>();
  for (const item of items) {
    const key = normalizeQuestionKey(item.question);
    if (key.length < 4) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), item]);
  }

  const groups: InconsistencyGroup[] = [];
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const distinctAnswers = new Set(group.map((i) => normalizeQuestionKey(i.answer)));
    if (distinctAnswers.size < 2) continue;
    groups.push({
      question: group[0].question,
      options: group.map((i) => ({ id: i.id, answer: i.answer })),
    });
  }
  return groups;
}

export interface DiaryInput {
  learnedThisWeek: { question: string }[];
  topGaps: { question: string; askCount: number }[];
  totalConversations: number;
  resolvedByAttendant: number;
  sentToTeam: number;
}

/** Diário do Atendente — resumo em linguagem de funcionário, sem IA. */
export function buildDiary(input: DiaryInput): string[] {
  const lines: string[] = [];
  lines.push(
    `Nesta semana participei de ${input.totalConversations} atendimento${input.totalConversations === 1 ? "" : "s"}: resolvi ${input.resolvedByAttendant} e precisei da equipe em ${input.sentToTeam}.`,
  );
  if (input.learnedThisWeek.length) {
    lines.push(
      `Aprendi ${input.learnedThisWeek.length} coisa${input.learnedThisWeek.length === 1 ? "" : "s"} nova${input.learnedThisWeek.length === 1 ? "" : "s"}: ${input.learnedThisWeek
        .slice(0, 3)
        .map((i) => `"${i.question}"`)
        .join(", ")}.`,
    );
  } else {
    lines.push("Não recebi treinamento novo nesta semana.");
  }
  if (input.topGaps.length) {
    lines.push(
      `Ainda preciso aprender: ${input.topGaps
        .slice(0, 3)
        .map((g) => `"${g.question}" (${g.askCount}x)`)
        .join(", ")}.`,
    );
  } else {
    lines.push("No momento não tenho dúvidas em aberto. 🎉");
  }
  return lines;
}

// ——— Registro silencioso durante o trabalho ———

const MAX_QUESTION_LENGTH = 300;
const MAX_ANSWER_LENGTH = 1500;

/** Registra uma pergunta que o Atendente não soube responder. Nunca lança. */
export async function recordKnowledgeGap(
  companyId: string,
  question: string,
  reason: string,
): Promise<void> {
  try {
    const cleaned = question.trim().slice(0, MAX_QUESTION_LENGTH);
    const questionKey = normalizeQuestionKey(cleaned);
    if (questionKey.length < 4) return;

    await prisma.knowledgeGap.upsert({
      where: { companyId_questionKey: { companyId, questionKey } },
      create: { companyId, questionKey, question: cleaned, reason: reason.slice(0, 200) },
      update: {
        askCount: { increment: 1 },
        lastAskedAt: new Date(),
        question: cleaned,
        ...(reason ? { reason: reason.slice(0, 200) } : {}),
      },
    });
  } catch (error) {
    await logError("training-gap", error, companyId);
  }
}

/**
 * Registra como OBSERVAÇÃO a resposta que a equipe deu a um cliente.
 * Vira sugestão na reunião de treinamento — nunca aprendizado automático.
 */
export async function recordTeamObservation(
  companyId: string,
  question: string,
  answer: string,
): Promise<void> {
  try {
    const q = question.trim().slice(0, MAX_QUESTION_LENGTH);
    const a = answer.trim().slice(0, MAX_ANSWER_LENGTH);
    if (q.length < 4 || a.length < 2) return;

    await prisma.knowledgeItem.create({
      data: { companyId, question: q, answer: a, source: "TEAM_OBSERVATION", status: "OBSERVED" },
    });
  } catch (error) {
    await logError("training-observation", error, companyId);
  }
}

/** Conhecimento aprovado — a ÚNICA fonte extra que entra no prompt. */
export async function getApprovedKnowledge(companyId: string, take = 50): Promise<Faq[]> {
  const items = await prisma.knowledgeItem.findMany({
    where: { companyId, status: "APPROVED" },
    orderBy: { approvedAt: "desc" },
    take,
    select: { question: true, answer: true },
  });
  return items.map((i) => ({ question: i.question, answer: i.answer }));
}

// ——— Reunião de treinamento ———

const MAX_GAPS_PER_SESSION = 3; // nunca dezenas de perguntas: só as de maior impacto

export async function getTrainingReport(companyId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalConversations, sentToTeam, topGaps, pendingItems, observations, approvedCount, learnedThisWeek, profile] =
    await Promise.all([
      prisma.conversation.count({ where: { companyId, createdAt: { gte: since } } }),
      prisma.conversation.count({
        where: {
          companyId,
          createdAt: { gte: since },
          OR: [{ status: { in: ["WAITING_HUMAN", "HUMAN"] } }, { messages: { some: { role: "HUMAN" } } }],
        },
      }),
      prisma.knowledgeGap.findMany({
        where: { companyId, status: "OPEN" },
        orderBy: [{ askCount: "desc" }, { lastAskedAt: "desc" }],
        take: MAX_GAPS_PER_SESSION,
      }),
      prisma.knowledgeItem.findMany({
        where: { companyId, status: "PENDING_APPROVAL" },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.knowledgeItem.findMany({
        where: { companyId, status: "OBSERVED" },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.knowledgeItem.count({ where: { companyId, status: "APPROVED" } }),
      prisma.knowledgeItem.findMany({
        where: { companyId, status: "APPROVED", approvedAt: { gte: since } },
        select: { question: true },
        take: 10,
      }),
      prisma.companyProfile.findUniqueOrThrow({ where: { companyId } }),
    ]);

  const openGaps = await prisma.knowledgeGap.count({ where: { companyId, status: "OPEN" } });
  const resolvedByAttendant = Math.max(0, totalConversations - sentToTeam);
  const score = computeKnowledgeScore(profile, approvedCount, openGaps);
  const diary = buildDiary({
    learnedThisWeek,
    topGaps: topGaps.map((g) => ({ question: g.question, askCount: g.askCount })),
    totalConversations,
    resolvedByAttendant,
    sentToTeam,
  });

  // Inconsistências: mesma pergunta, respostas diferentes da equipe
  const inconsistencies = findInconsistencies(observations);
  const conflictedIds = new Set(inconsistencies.flatMap((g) => g.options.map((o) => o.id)));

  // KUS: entrevista de integração disponível quando a EMPRESA já escolheu suas
  // áreas de atuação e a entrevista ainda não começou (templates combinados)
  let interview: { segmentName: string; topics: SegmentTopic[] } | null = null;
  const segments = asSegments(profile.segments);
  if (segments.length && !profile.interviewStartedAt) {
    const combined = await getTemplatesForSegments(segments);
    if (combined) interview = { segmentName: combined.names.join(" + "), topics: combined.topics };
  }

  return {
    stats: { totalConversations, resolvedByAttendant, sentToTeam },
    topGaps,
    pendingItems,
    observations: observations.filter((o) => !conflictedIds.has(o.id)).slice(0, 10),
    inconsistencies,
    interview,
    score,
    diary,
  };
}

/**
 * Empresa respondeu uma dúvida no treinamento → o sistema ESTRUTURA a resposta
 * (pergunta canônica + resposta clara, preservando números/condições) e cria o
 * item AGUARDANDO APROVAÇÃO. Se a estruturação falhar, usa o texto original —
 * o treino nunca trava.
 */
export async function teachAnswer(
  companyId: string,
  input: { gapId?: string; question: string; answer: string },
): Promise<KnowledgeItem> {
  if (input.gapId) {
    const gap = await prisma.knowledgeGap.findFirst({ where: { id: input.gapId, companyId } });
    if (!gap) throw new Error("Dúvida não encontrada");
  }

  let question = input.question.trim().slice(0, MAX_QUESTION_LENGTH);
  let answer = input.answer.trim().slice(0, MAX_ANSWER_LENGTH);

  try {
    const structured = await structureTrainedAnswer(question, answer);
    question = structured.question.slice(0, MAX_QUESTION_LENGTH);
    answer = structured.answer.slice(0, MAX_ANSWER_LENGTH);
  } catch (error) {
    await logError("training-structure", error, companyId);
  }

  return prisma.knowledgeItem.create({
    data: {
      companyId,
      question,
      answer,
      source: "TRAINING",
      status: "PENDING_APPROVAL",
      gapId: input.gapId ?? null,
    },
  });
}

/** Aprovar (com edição opcional) ou rejeitar um item. Só APPROVED entra em uso. */
export async function reviewKnowledgeItem(
  companyId: string,
  itemId: string,
  action: "aprovar" | "rejeitar",
  edits?: { question?: string; answer?: string },
): Promise<void> {
  const item = await prisma.knowledgeItem.findFirst({ where: { id: itemId, companyId } });
  if (!item) throw new Error("Item não encontrado");

  if (action === "rejeitar") {
    await prisma.knowledgeItem.update({ where: { id: item.id }, data: { status: "REJECTED" } });
    return;
  }

  await prisma.knowledgeItem.update({
    where: { id: item.id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      ...(edits?.question?.trim() ? { question: edits.question.trim().slice(0, MAX_QUESTION_LENGTH) } : {}),
      ...(edits?.answer?.trim() ? { answer: edits.answer.trim().slice(0, MAX_ANSWER_LENGTH) } : {}),
    },
  });

  if (item.gapId) {
    await prisma.knowledgeGap
      .update({ where: { id: item.gapId }, data: { status: "ANSWERED" } })
      .catch(() => {});
  }
}

/** Empresa marcou a dúvida como irrelevante — sai da fila de treinamento. */
export async function dismissGap(companyId: string, gapId: string): Promise<void> {
  const gap = await prisma.knowledgeGap.findFirst({ where: { id: gapId, companyId } });
  if (!gap) throw new Error("Dúvida não encontrada");
  await prisma.knowledgeGap.update({ where: { id: gap.id }, data: { status: "DISMISSED" } });
}
