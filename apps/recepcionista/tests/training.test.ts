import { describe, expect, it } from "vitest";
import { buildDiary, computeKnowledgeScore, findInconsistencies, normalizeQuestionKey } from "@/lib/training";
import { parseStructuredKnowledge } from "@/lib/ai/provider";

describe("normalizeQuestionKey — dedupe de variações da mesma dúvida", () => {
  it("iguala variações de acento, caixa e pontuação", () => {
    expect(normalizeQuestionKey("Como funciona a GARANTIA???")).toBe(
      normalizeQuestionKey("como funciona a garantia"),
    );
    expect(normalizeQuestionKey("Vocês têm garantia?")).toBe(normalizeQuestionKey("voces tem garantia"));
  });

  it("limita o tamanho da chave", () => {
    expect(normalizeQuestionKey("a".repeat(500)).length).toBeLessThanOrEqual(140);
  });
});

const fullProfile = {
  description: "Empresa de serviços",
  address: "Av. Central, 1000",
  productsServices: "Serviço padrão",
  pricingInfo: "R$ 250",
  paymentMethods: "Pix e cartão",
  serviceRules: "A equipe confirma prazos",
  businessHours: [{ day: 1, open: "08:00", close: "18:00", closed: false }],
  faqs: [
    { question: "a", answer: "b" },
    { question: "c", answer: "d" },
  ],
};

describe("computeKnowledgeScore", () => {
  it("cadastro completo sem dúvidas em aberto tem score alto", () => {
    const score = computeKnowledgeScore(fullProfile, 3, 0);
    expect(score.overall).toBeGreaterThanOrEqual(90);
    expect(score.areas.find((a) => a.label === "Horários")?.pct).toBe(100);
    expect(score.areas.find((a) => a.label === "Dúvidas treinadas")?.pct).toBe(100);
  });

  it("dúvidas em aberto penalizam o score", () => {
    const clean = computeKnowledgeScore(fullProfile, 3, 0);
    const withGaps = computeKnowledgeScore(fullProfile, 3, 5);
    expect(withGaps.overall).toBeLessThan(clean.overall);
    expect(withGaps.openGaps).toBe(5);
  });

  it("área vazia aparece como 0% (mostra onde treinar)", () => {
    const score = computeKnowledgeScore({ ...fullProfile, pricingInfo: "" }, 0, 0);
    expect(score.areas.find((a) => a.label === "Preços")?.pct).toBe(0);
  });
});

describe("findInconsistencies", () => {
  it("agrupa respostas diferentes para a mesma pergunta", () => {
    const groups = findInconsistencies([
      { id: "1", question: "Vocês parcelam?", answer: "Parcelamos em 6x" },
      { id: "2", question: "voces parcelam", answer: "Parcelamos em 12x sem juros" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].options).toHaveLength(2);
  });

  it("mesma resposta repetida não é inconsistência", () => {
    expect(
      findInconsistencies([
        { id: "1", question: "Vocês parcelam?", answer: "Em 6x" },
        { id: "2", question: "Vocês parcelam?", answer: "em 6x!" },
      ]),
    ).toHaveLength(0);
  });

  it("perguntas diferentes não agrupam", () => {
    expect(
      findInconsistencies([
        { id: "1", question: "Vocês parcelam?", answer: "Em 6x" },
        { id: "2", question: "Qual o horário?", answer: "8h às 18h" },
      ]),
    ).toHaveLength(0);
  });
});

describe("parseStructuredKnowledge", () => {
  it("valida a estrutura pergunta/resposta", () => {
    const result = parseStructuredKnowledge(
      '{"pergunta":"Quanto custa a instalação de câmeras?","resposta":"Até 4 câmeras: R$ 800. Acima disso, orçamento com a equipe."}',
    );
    expect(result.question).toContain("câmeras");
    expect(result.answer).toContain("R$ 800");
  });

  it("aceita cercas de código e rejeita JSON incompleto", () => {
    expect(parseStructuredKnowledge('```json\n{"pergunta":"Qual o prazo?","resposta":"5 dias úteis."}\n```').answer).toBe(
      "5 dias úteis.",
    );
    expect(() => parseStructuredKnowledge('{"pergunta":"só pergunta"}')).toThrow();
    expect(() => parseStructuredKnowledge("sem json")).toThrow();
  });
});

describe("buildDiary", () => {
  it("resume a semana em linguagem de funcionário", () => {
    const diary = buildDiary({
      learnedThisWeek: [{ question: "Como funciona a garantia" }],
      topGaps: [{ question: "Prazo de entrega", askCount: 7 }],
      totalConversations: 42,
      resolvedByAttendant: 39,
      sentToTeam: 3,
    });
    expect(diary.join(" ")).toContain("42 atendimentos");
    expect(diary.join(" ")).toContain("Como funciona a garantia");
    expect(diary.join(" ")).toContain("Prazo de entrega");
  });

  it("sem dúvidas em aberto, comemora", () => {
    const diary = buildDiary({
      learnedThisWeek: [],
      topGaps: [],
      totalConversations: 5,
      resolvedByAttendant: 5,
      sentToTeam: 0,
    });
    expect(diary.join(" ")).toContain("não tenho dúvidas em aberto");
  });
});
