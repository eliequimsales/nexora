import { describe, expect, it } from "vitest";
import { formatBusinessHoursCompact, isPureGreeting } from "@/lib/ai/quick-reply";
import { detectarIntencao } from "@/lib/atendente/intencao";
import type { BusinessHour } from "@/lib/validation";

const hours: BusinessHour[] = [
  { day: 0, open: "08:00", close: "18:00", closed: true },
  { day: 1, open: "08:00", close: "18:00", closed: false },
  { day: 2, open: "08:00", close: "18:00", closed: false },
  { day: 3, open: "08:00", close: "18:00", closed: false },
  { day: 4, open: "08:00", close: "18:00", closed: false },
  { day: 5, open: "08:00", close: "18:00", closed: false },
  { day: 6, open: "08:00", close: "12:00", closed: false },
];

// O mesmo pedido de pessoa que o atendimento antigo reconhecia, agora pela
// intenção do Atendente Virtual — decidido por palavra, antes de qualquer IA.
const intencao = (texto: string) =>
  detectarIntencao(texto, {
    servicos: [],
    profissionais: [],
    palavrasDoDono: [],
    estado: null,
    agora: new Date("2026-09-22T13:00:00.000Z"),
  }).tipo;

describe("pedido de pessoa pelos termos padrão, sem IA", () => {
  it("pedido de humano/atendente/suporte vai para a equipe", () => {
    for (const texto of [
      "quero falar com um atendente",
      "tem como falar com humano?",
      "preciso do suporte",
      "quero falar com o responsável!!",
      "quero falar com alguém aí",
    ]) {
      expect(intencao(texto), texto).toBe("PESSOA");
    }
  });

  it("mensagem comum não vira pedido de pessoa", () => {
    expect(intencao("qual o horário de vocês?")).not.toBe("PESSOA");
    expect(intencao("quero um orçamento")).not.toBe("PESSOA");
  });
});

describe("isPureGreeting", () => {
  it("reconhece cumprimentos puros", () => {
    expect(isPureGreeting("Oi")).toBe(true);
    expect(isPureGreeting("bom dia!!")).toBe(true);
    expect(isPureGreeting("olá, tudo bem?")).toBe(true);
  });

  it("não confunde pergunta com cumprimento", () => {
    expect(isPureGreeting("oi, quanto custa?")).toBe(false);
  });
});

describe("formatBusinessHoursCompact", () => {
  it("agrupa dias consecutivos com o mesmo horário", () => {
    expect(formatBusinessHoursCompact(hours)).toBe(
      "seg a sex das 08:00 às 18:00; sáb das 08:00 às 12:00; dom fechado",
    );
  });
});
