import { describe, expect, it, vi } from "vitest";
import { isEligibleForFollowUp, runFollowUps } from "@/lib/followup";

const NOW = new Date("2026-07-01T18:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);

const base = {
  status: "AI",
  followUpCount: 0,
  maxFollowUps: 2,
  delayHours: 4,
  lastCustomerMessageAt: hoursAgo(5),
  lastFollowUpAt: null,
};

describe("isEligibleForFollowUp", () => {
  it("elegível: IA atendendo, cliente sumiu há mais tempo que o delay", () => {
    expect(isEligibleForFollowUp(base, NOW)).toBe(true);
  });

  it("não elegível: cliente respondeu há pouco", () => {
    expect(isEligibleForFollowUp({ ...base, lastCustomerMessageAt: hoursAgo(1) }, NOW)).toBe(false);
  });

  it("não elegível: atingiu o máximo de follow-ups", () => {
    expect(isEligibleForFollowUp({ ...base, followUpCount: 2 }, NOW)).toBe(false);
  });

  it("não elegível: conversa com humano ou finalizada", () => {
    expect(isEligibleForFollowUp({ ...base, status: "HUMAN" }, NOW)).toBe(false);
    expect(isEligibleForFollowUp({ ...base, status: "WAITING_HUMAN" }, NOW)).toBe(false);
    expect(isEligibleForFollowUp({ ...base, status: "FINISHED" }, NOW)).toBe(false);
  });

  it("não elegível: follow-up recente (respeita intervalo entre envios)", () => {
    expect(isEligibleForFollowUp({ ...base, lastFollowUpAt: hoursAgo(2) }, NOW)).toBe(false);
    expect(isEligibleForFollowUp({ ...base, lastFollowUpAt: hoursAgo(5) }, NOW)).toBe(true);
  });

  it("não elegível: conversa sem mensagem do cliente", () => {
    expect(isEligibleForFollowUp({ ...base, lastCustomerMessageAt: null }, NOW)).toBe(false);
  });
});

/**
 * O WORKER NÃO PODE ENCHER O LOG COM O MESMO ERRO DE CONFIGURAÇÃO.
 *
 * Sem gateway configurado, cada conversa elegível chamava `sendWhatsAppText`,
 * que lançava, e o catch de dentro do laço gravava uma linha em ErrorLog e
 * imprimia no console — por conversa, a cada 5 minutos, para sempre. Em
 * produção (12/09/2026) isso encheu o log com a mesma frase dezenas de vezes,
 * o que esconde o primeiro erro de verdade que aparecer.
 *
 * O problema é de configuração: ou vale para todas as conversas, ou para
 * nenhuma. Então a rodada inteira é pulada, sem tocar o banco, e o aviso sai
 * uma vez por processo.
 */
describe("runFollowUps com o WhatsApp sem servidor", () => {
  it("pula a rodada e avisa UMA vez, não a cada ciclo", async () => {
    const url = process.env.EVOLUTION_API_URL;
    const key = process.env.EVOLUTION_API_KEY;
    delete process.env.EVOLUTION_API_URL;
    delete process.env.EVOLUTION_API_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      expect(await runFollowUps()).toBe(0);
      expect(await runFollowUps()).toBe(0);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toMatch(/lembretes parados/i);
    } finally {
      warn.mockRestore();
      if (url !== undefined) process.env.EVOLUTION_API_URL = url;
      if (key !== undefined) process.env.EVOLUTION_API_KEY = key;
    }
  });
});
