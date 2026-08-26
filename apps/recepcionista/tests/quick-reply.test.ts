import { describe, expect, it } from "vitest";
import { matchesHandoffKeyword } from "@/lib/ai/handoff";
import {
  DEFAULT_HANDOFF_TERMS,
  formatBusinessHoursCompact,
  isPureGreeting,
  matchQuickReply,
} from "@/lib/ai/quick-reply";
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

const ctx = {
  companyName: "Empresa Demonstração",
  greetingMessage: "Olá! Aqui é o atendimento da Empresa Demonstração. Como posso ajudar?",
  businessHours: hours,
  address: "Av. Central, 1000 — Centro, São Paulo/SP",
  paymentMethods: "Pix, dinheiro e cartão em até 6x sem juros",
  isFirstMessage: false,
};

describe("matchQuickReply — respostas sem IA", () => {
  it("pergunta de horário responde direto do cadastro", () => {
    const reply = matchQuickReply("Qual o horário de funcionamento?", ctx);
    expect(reply).toContain("seg a sex das 08:00 às 18:00");
    expect(reply).toContain("sáb das 08:00 às 12:00");
  });

  it("pergunta de endereço responde direto do cadastro", () => {
    const reply = matchQuickReply("Onde fica a loja de vocês?", ctx);
    expect(reply).toContain("Av. Central, 1000");
  });

  it("pergunta de pagamento responde direto do cadastro", () => {
    const reply = matchQuickReply("Vocês aceitam cartão?", ctx);
    expect(reply).toContain("Pix, dinheiro e cartão");
  });

  it("saudação pura na primeira mensagem usa a saudação cadastrada", () => {
    const reply = matchQuickReply("boa noite!", { ...ctx, isFirstMessage: true });
    expect(reply).toBe(ctx.greetingMessage);
  });

  it("saudação em conversa em andamento vai para o modelo", () => {
    expect(matchQuickReply("boa noite!", ctx)).toBeNull();
  });

  it("mensagem longa/complexa vai para o modelo", () => {
    const long =
      "Oi, queria saber o horário de vocês mas também preciso entender se dá pra parcelar um serviço grande que envolve várias visitas e um contrato anual da minha empresa";
    expect(matchQuickReply(long, ctx)).toBeNull();
  });

  it("mais de uma intenção na mesma mensagem vai para o modelo", () => {
    expect(matchQuickReply("Qual o horário e o endereço?", ctx)).toBeNull();
  });

  it("pergunta fora do cadastro (preço/entrega) vai para o modelo", () => {
    expect(matchQuickReply("Quanto custa o serviço?", ctx)).toBeNull();
    expect(matchQuickReply("Vocês fazem entrega?", ctx)).toBeNull();
  });

  it("cadastro vazio não responde direto (modelo decide encaminhar)", () => {
    expect(matchQuickReply("Onde fica?", { ...ctx, address: "" })).toBeNull();
  });
});

describe("handoff sem IA (termos padrão)", () => {
  it("pedido de humano/atendente/suporte dispara handoff", () => {
    expect(matchesHandoffKeyword("quero falar com um atendente", DEFAULT_HANDOFF_TERMS)).toBe(true);
    expect(matchesHandoffKeyword("tem como falar com humano?", DEFAULT_HANDOFF_TERMS)).toBe(true);
    expect(matchesHandoffKeyword("preciso do suporte", DEFAULT_HANDOFF_TERMS)).toBe(true);
    expect(matchesHandoffKeyword("quero falar com o responsável!!", DEFAULT_HANDOFF_TERMS)).toBe(true);
    expect(matchesHandoffKeyword("quero falar com alguém aí", DEFAULT_HANDOFF_TERMS)).toBe(true);
  });

  it("mensagem comum não dispara handoff", () => {
    expect(matchesHandoffKeyword("qual o horário de vocês?", DEFAULT_HANDOFF_TERMS)).toBe(false);
    expect(matchesHandoffKeyword("quero um orçamento", DEFAULT_HANDOFF_TERMS)).toBe(false);
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
