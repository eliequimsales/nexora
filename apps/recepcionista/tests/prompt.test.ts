import { describe, expect, it } from "vitest";
import { buildSystemPrompt, isOpenNow, formatBusinessHours } from "@/lib/ai/prompt";
import type { BusinessHour } from "@/lib/validation";

// Quarta-feira, 2026-07-01 15:00 UTC = 12:00 em São Paulo (UTC-3)
const WEDNESDAY_NOON_SP = new Date("2026-07-01T15:00:00Z");
// Quarta-feira, 2026-07-01 05:00 UTC = 02:00 em São Paulo
const WEDNESDAY_2AM_SP = new Date("2026-07-01T05:00:00Z");

const weekdayHours: BusinessHour[] = [
  { day: 0, open: "08:00", close: "18:00", closed: true },
  { day: 1, open: "08:00", close: "18:00", closed: false },
  { day: 2, open: "08:00", close: "18:00", closed: false },
  { day: 3, open: "08:00", close: "18:00", closed: false },
  { day: 4, open: "08:00", close: "18:00", closed: false },
  { day: 5, open: "08:00", close: "18:00", closed: false },
  { day: 6, open: "08:00", close: "12:00", closed: false },
];

describe("isOpenNow", () => {
  it("aberto em horário comercial no fuso de São Paulo", () => {
    expect(isOpenNow(weekdayHours, WEDNESDAY_NOON_SP)).toBe(true);
  });

  it("fechado de madrugada", () => {
    expect(isOpenNow(weekdayHours, WEDNESDAY_2AM_SP)).toBe(false);
  });

  it("fechado em dia marcado como closed", () => {
    // Domingo 2026-07-05 15:00 UTC = 12:00 SP
    expect(isOpenNow(weekdayHours, new Date("2026-07-05T15:00:00Z"))).toBe(false);
  });

  it("sem horário cadastrado, considera aberto (não bloqueia o MVP)", () => {
    expect(isOpenNow([], WEDNESDAY_2AM_SP)).toBe(true);
  });

  it("suporta faixa que cruza a meia-noite", () => {
    const nightBar: BusinessHour[] = [
      { day: 2, open: "18:00", close: "02:00", closed: false }, // terça 18h → quarta 2h
    ];
    // Quarta 01:00 SP (madrugada) — coberto pela faixa de terça
    expect(isOpenNow(nightBar, new Date("2026-07-01T04:00:00Z"))).toBe(true);
    // Quarta 12:00 SP — fora da faixa
    expect(isOpenNow(nightBar, WEDNESDAY_NOON_SP)).toBe(false);
  });
});

describe("buildSystemPrompt", () => {
  const baseContext = {
    companyName: "Empresa Demonstração",
    description: "Empresa de produtos e serviços em São Paulo",
    address: "Av. Central, 1000",
    productsServices: "Serviço padrão, plano mensal",
    pricingInfo: "Serviço padrão: R$ 250",
    paymentMethods: "Pix e cartão",
    serviceRules: "Nunca confirmar prazo como garantido",
    aiTone: "acolhedor e informal",
    greetingMessage: "Olá! Aqui é o atendente da Empresa Demonstração.",
    awayMessage: "Estamos fechados, retornamos amanhã às 8h.",
    businessHours: weekdayHours,
    faqs: [{ question: "Vocês emitem nota fiscal?", answer: "Sim, para todos os serviços." }],
    isOpen: true,
    isFirstMessage: true,
    localTimeFormatted: "quarta, 12:00",
  };

  it("inclui todos os dados do cadastro da empresa", () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain("Empresa Demonstração");
    expect(prompt).toContain("Av. Central, 1000");
    expect(prompt).toContain("Serviço padrão: R$ 250");
    expect(prompt).toContain("Vocês emitem nota fiscal?");
    expect(prompt).toContain("Nunca confirmar prazo");
    expect(prompt).toContain("acolhedor e informal");
  });

  it("proíbe inventar informação", () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain("NUNCA invente");
    expect(prompt).toContain("Nunca crie preços, promoções, prazos, condições ou serviços");
  });

  it("exige respostas curtas e uma pergunta por vez", () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain("1 a 3 frases");
    expect(prompt).toContain("UMA pergunta por vez");
  });

  it("proíbe falar como IA ou sobre tecnologia", () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain("Nunca diga que é uma inteligência artificial");
    expect(prompt).toContain("Nunca fale sobre tecnologia");
  });

  it("vocabulário de área nunca vira dado da empresa (regra absoluta do KUS)", () => {
    const prompt = buildSystemPrompt({
      ...baseContext,
      segments: ["Academia", "Loja de Suplementos"],
      segmentTopics: ["Planos", "Matrícula", "Suplementos"],
    });
    expect(prompt).toContain("Academia + Loja de Suplementos");
    expect(prompt).toContain("REGRA ABSOLUTA DO SEGMENTO");
    expect(prompt).toContain("Nunca assuma nada");
    expect(buildSystemPrompt(baseContext)).not.toContain("REGRA ABSOLUTA DO SEGMENTO");
  });

  it("inclui o conhecimento aprovado no treinamento (e só quando existe)", () => {
    const withTraining = buildSystemPrompt({
      ...baseContext,
      approvedKnowledge: [{ question: "Como funciona a garantia?", answer: "12 meses para defeitos." }],
    });
    expect(withTraining).toContain("Conhecimento ensinado pela empresa no treinamento");
    expect(withTraining).toContain("12 meses para defeitos.");
    expect(buildSystemPrompt(baseContext)).not.toContain("Conhecimento ensinado pela empresa");
  });

  it("define o fluxo rápido de decisão com encaminhamento seguro", () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain("posso chamar nossa equipe para te responder corretamente");
    expect(prompt).toContain("Claro, vou chamar nossa equipe para continuar seu atendimento");
  });

  it("usa saudação na primeira mensagem e não repete depois", () => {
    expect(buildSystemPrompt(baseContext)).toContain("PRIMEIRA mensagem");
    expect(buildSystemPrompt({ ...baseContext, isFirstMessage: false })).toContain(
      "Não repita saudações",
    );
  });

  it("avisa quando a empresa está fechada e injeta a mensagem fora do horário", () => {
    const prompt = buildSystemPrompt({ ...baseContext, isOpen: false });
    expect(prompt).toContain("FECHADA");
    expect(prompt).toContain("Estamos fechados, retornamos amanhã às 8h.");
  });
});

describe("formatBusinessHours", () => {
  it("formata dias e marca fechados", () => {
    const text = formatBusinessHours(weekdayHours);
    expect(text).toContain("segunda: 08:00 às 18:00");
    expect(text).toContain("domingo: fechado");
  });
});
