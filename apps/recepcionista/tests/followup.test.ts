import { describe, expect, it } from "vitest";
import { isEligibleForFollowUp } from "@/lib/followup";

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
