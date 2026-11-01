import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  conversation: { findFirst: vi.fn(), findMany: vi.fn() },
  message: { findFirst: vi.fn() },
  companyProfile: { findUnique: vi.fn() },
  conversationEvaluation: { findUnique: vi.fn(), create: vi.fn() },
  knowledgeGap: { upsert: vi.fn() },
  transaction: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { ...mocks, $transaction: mocks.transaction } }));
import { avaliarAtendimento, getAvaliacaoAtendimento, getResumoResultados } from "@/lib/atendimento/avaliacao";
import { avaliacaoAtendimentoSchema, resumirResultados } from "@/lib/atendimento/avaliacao-schema";

const input = { requestId: "cdeef065-7653-4128-8847-dd78e610a91a", lastMessageId: "ai1", outcome: "RESOLVIDO_ATENDENTE", note: "" };
const data = new Date("2026-10-26T12:00:00Z");
const conversa = { id: "conversa", status: "AI", messages: [
  { id: "ai1", role: "AI", content: "A sessão custa R$ 170.", createdAt: data },
  { id: "c1", role: "CUSTOMER", content: "Qual o preço da sessão?", createdAt: new Date("2026-10-26T11:59:00Z") },
] };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async cb => cb(mocks));
  mocks.conversation.findFirst.mockResolvedValue(conversa);
  mocks.conversationEvaluation.findUnique.mockResolvedValue(null);
  mocks.conversationEvaluation.create.mockImplementation(async ({ data }) => ({ id: "evaluation", ...data }));
  mocks.message.findFirst.mockImplementation(async ({ where }) => where.role === "AI" ? { id: "ai1" } : null);
  mocks.companyProfile.findUnique.mockResolvedValue({ atendenteConfiguracao: { publicado: { revisao: 7 } } });
});

describe("avaliação explícita e persistida", () => {
  it("salva origem, contexto e revisão sem executar ação nem aprender regra", async () => {
    await expect(avaliarAtendimento("empresa", "conversa", input)).resolves.toEqual({ id: "evaluation", outcome: "RESOLVIDO_ATENDENTE" });
    expect(mocks.conversation.findFirst.mock.calls[0][0].where).toEqual({ id: "conversa", companyId: "empresa" });
    const saved = mocks.conversationEvaluation.create.mock.calls[0][0].data;
    expect(saved).toMatchObject({ companyId: "empresa", conversationId: "conversa", source: "OWNER", anchorMessageId: "ai1", context: { publishedRevision: 7, status: "AI" } });
    expect(saved.context.messages.map((m: { id: string }) => m.id)).toEqual(["c1", "ai1"]);
    expect(mocks.knowledgeGap.upsert).not.toHaveBeenCalled();
  });
  it("não permite avaliar conversa de outra empresa", async () => {
    mocks.conversation.findFirst.mockResolvedValue(null);
    await expect(avaliarAtendimento("outra", "conversa", input)).rejects.toMatchObject({ status: 404 });
    expect(mocks.conversationEvaluation.create).not.toHaveBeenCalled();
  });
  it("não aplica avaliação a mensagens posteriores que o dono ainda não leu", async () => {
    await expect(avaliarAtendimento("empresa", "conversa", { ...input, lastMessageId: "antiga" })).rejects.toMatchObject({ status: 409 });
    expect(mocks.conversationEvaluation.create).not.toHaveBeenCalled();
  });
  it("não permite atribuir sucesso à IA sem resposta registrada", async () => {
    mocks.message.findFirst.mockResolvedValue(null);
    await expect(avaliarAtendimento("empresa", "conversa", input)).rejects.toMatchObject({ status: 400 });
  });
  it.each(["HUMAN", "WAITING_HUMAN"])("não chama de autônomo um atendimento com status %s", async status => {
    mocks.conversation.findFirst.mockResolvedValue({ ...conversa, status });
    await expect(avaliarAtendimento("empresa", "conversa", input)).rejects.toMatchObject({ status: 400 });
  });
  it("detecta intervenção humana mesmo que a IA tenha sido reativada", async () => {
    mocks.message.findFirst.mockResolvedValue({ id: "participacao" });
    await expect(avaliarAtendimento("empresa", "conversa", input)).rejects.toMatchObject({ status: 400 });
  });
  it("correção reabre uma lacuna revisável na mesma transação", async () => {
    await avaliarAtendimento("empresa", "conversa", { ...input, outcome: "PRECISA_CORRIGIR", note: "O preço deveria ser R$ 180 conforme a tabela atualizada." });
    expect(mocks.knowledgeGap.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { companyId_questionKey: { companyId: "empresa", questionKey: "qual o preco da sessao" } },
      update: expect.objectContaining({ status: "OPEN", askCount: { increment: 1 } }),
    }));
  });
  it("repetição da mesma tentativa não duplica avaliação nem lacuna", async () => {
    mocks.conversationEvaluation.findUnique.mockResolvedValue({ id: "salva", conversationId: "conversa", anchorMessageId: "ai1", outcome: input.outcome, note: "" });
    await expect(avaliarAtendimento("empresa", "conversa", input)).resolves.toEqual({ id: "salva", outcome: input.outcome });
    expect(mocks.conversationEvaluation.create).not.toHaveBeenCalled();
    expect(mocks.knowledgeGap.upsert).not.toHaveBeenCalled();
  });
  it("não permite reutilizar uma tentativa para outro conteúdo", async () => {
    mocks.conversationEvaluation.findUnique.mockResolvedValue({ id: "salva", conversationId: "conversa", anchorMessageId: "ai1", outcome: "DESCONHECIDO", note: "" });
    await expect(avaliarAtendimento("empresa", "conversa", input)).rejects.toMatchObject({ status: 409 });
  });
  it("conflito transacional não aparece como salvamento confirmado", async () => {
    mocks.transaction.mockRejectedValue({ code: "P2034" });
    await expect(avaliarAtendimento("empresa", "conversa", input)).rejects.toMatchObject({ status: 409 });
  });
  it("contexto de avaliação fica desatualizado quando chegam novas mensagens", async () => {
    mocks.conversation.findFirst.mockResolvedValue({ messages: [{ id: "nova" }], evaluations: [{ id: "e", outcome: "RESOLVIDO_ATENDENTE", source: "OWNER", anchorMessageId: "ai1", createdAt: data, note: "" }] });
    expect(await getAvaliacaoAtendimento("empresa", "conversa")).toMatchObject({ lastMessageId: "nova", evaluation: { current: false } });
  });
});

describe("métricas com evidência", () => {
  it("conversas sem avaliação nunca viram resolução por subtração", () => {
    const r = resumirResultados([{ messages: [{ id: "ai1" }], evaluations: [] }, { messages: [], evaluations: [] }]);
    expect(r).toMatchObject({ awaitingReview: 2, resolvedByAttendant: 0, reviewed: 0 });
  });
  it("retira o sucesso anterior diante de novas mensagens e mantém todos os estados separados", () => {
    const outcomes = ["RESOLVIDO_ATENDENTE", "RESOLVIDO_EQUIPE", "PRECISA_CORRIGIR", "ASSUMIDO_EQUIPE", "DESCONHECIDO", "REABERTO"];
    const r = resumirResultados([
      ...outcomes.map(outcome => ({ messages: [{ id: "m" }], evaluations: [{ outcome, source: "OWNER", anchorMessageId: "m" }] })),
      { messages: [{ id: "nova" }], evaluations: [{ outcome: "RESOLVIDO_ATENDENTE", source: "OWNER", anchorMessageId: "antiga" }] },
    ]);
    expect(r).toEqual({ reviewed: 6, resolvedByAttendant: 1, resolvedByTeam: 1, needsCorrection: 1, takenOver: 1, unknown: 1, reopened: 2, awaitingReview: 0 });
  });
  it("uma origem desconhecida ou estado inválido não conta como avaliação do dono", () => {
    const r = resumirResultados([
      { messages: [{ id: "m" }], evaluations: [{ outcome: "RESOLVIDO_ATENDENTE", source: "MODEL", anchorMessageId: "m" }] },
      { messages: [{ id: "m" }], evaluations: [{ outcome: "INVENTADO", source: "OWNER", anchorMessageId: "m" }] },
    ]);
    expect(r.awaitingReview).toBe(2); expect(r.resolvedByAttendant).toBe(0);
  });
  it("consulta somente conversas e avaliações da empresa e do período", async () => {
    mocks.conversation.findMany.mockResolvedValue([]);
    expect((await getResumoResultados("empresa", data)).resolvedByAttendant).toBe(0);
    expect(mocks.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: "empresa", createdAt: { gte: data } }, select: expect.objectContaining({ evaluations: expect.objectContaining({ where: { companyId: "empresa" } }) }) }));
  });
  it("exige contexto e instrução útil na correção; rejeita companyId enviado pelo cliente", () => {
    expect(avaliacaoAtendimentoSchema.safeParse({ ...input, companyId: "outra" }).success).toBe(false);
    expect(avaliacaoAtendimentoSchema.safeParse({ ...input, outcome: "PRECISA_CORRIGIR", note: "" }).success).toBe(false);
    expect(avaliacaoAtendimentoSchema.safeParse({ ...input, lastMessageId: "" }).success).toBe(false);
  });
});
