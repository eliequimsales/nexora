import { describe, expect, it } from "vitest";
import { isOpenNow } from "@/lib/ai/prompt";
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
