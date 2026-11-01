import { describe, expect, it } from "vitest";
import { aplicarHorariosDaConversa, horariosDaConversaSchema, type GrupoHorarioDaConversa } from "@/lib/atendente/conversa-horarios";

const aberto = (dias: number[], evidencia: string, abre = "09:00", fecha = "18:00"): GrupoHorarioDaConversa => ({ dias, evidencia, abre, fecha, fechado: false });
const fechado = (dias: number[], evidencia: string): GrupoHorarioDaConversa => ({ dias, evidencia, abre: null, fecha: null, fechado: true });

describe("horários estruturados comprovados pela conversa", () => {
  it("preserva compatibilidade com extração antiga sem horários", () => { expect(horariosDaConversaSchema.parse(undefined)).toEqual([]); });
  it("registra cinco dias abertos e os dois dias explicitamente fechados", () => {
    const grupos = [aberto([2, 3, 4, 5, 6], "Terça a sábado das 9 às 18."), fechado([0, 1], "Domingo e segunda fechados.")];
    const r = aplicarHorariosDaConversa([], grupos, () => true)!;
    expect(r).toHaveLength(7); expect(r.filter(h => h.closed).map(h => h.day)).toEqual([0, 1]);
    expect(r.filter(h => !h.closed).every(h => h.open === "09:00" && h.close === "18:00")).toBe(true);
  });
  it.each(["De seg. a sex. das 09:30 às 18:15", "De segunda-feira a sexta-feira, abro às 9:30 e fecho às 18:15"])("aceita abreviações, minutos e verbos explícitos: %s", evidencia => {
    expect(aplicarHorariosDaConversa([], [aberto([1, 2, 3, 4, 5], evidencia, "09:30", "18:15")], () => true)).toHaveLength(5);
  });
  it("não transforma horários ausentes em fechado e preserva outros dias da base", () => {
    const base = [{ day: 0, open: "10:00", close: "12:00", closed: false }];
    const r = aplicarHorariosDaConversa(base, [aberto([2], "Terça das 9 às 18")], () => true)!;
    expect(r).toHaveLength(2); expect(r[0]).toEqual(base[0]); expect(base).toHaveLength(1);
  });
  it.each([
    aberto([2, 2], "Terça das 9 às 18"), aberto([7], "Terça das 9 às 18"),
    aberto([2], "Quarta das 9 às 18"), aberto([2], "Terça das 10 às 18"),
    aberto([2], "Terça das 9 às 18", "25:00"), aberto([2], "Terça das 9 às 18", "18:00", "09:00"),
    fechado([2], "Terça das 9 às 18"), fechado([0, 1], "Domingo fechado"),
    aberto([2], "Terça custa de R$9 a 18 reais"),
  ])("não aceita dias/horários inventados, duplicados ou fechamento presumido: %j", grupo => {
    expect(aplicarHorariosDaConversa([], [grupo], () => true)).toBeNull();
  });
  it("exige a evidência declarativa do próprio responsável", () => {
    expect(aplicarHorariosDaConversa([], [aberto([2], "Terça das 9 às 18")], () => false)).toBeNull();
  });
  it("não escolhe um entre dois grupos contraditórios para o mesmo dia", () => {
    expect(aplicarHorariosDaConversa([], [aberto([2], "Terça das 9 às 18"), fechado([2], "Terça fechado")], () => true)).toBeNull();
  });
  it("aceita todos os dias somente quando isso foi dito", () => {
    expect(aplicarHorariosDaConversa([], [aberto([0, 1, 2, 3, 4, 5, 6], "Todos os dias das 9 às 18")], () => true)).toHaveLength(7);
  });
  it("aceita restantes fechados quando o conjunto restante está explícito", () => {
    const r = aplicarHorariosDaConversa([], [aberto([2, 3, 4, 5, 6], "Terça a sábado das 9 às 18"), fechado([0, 1], "Os demais dias ficam fechados")], () => true)!;
    expect(r).toHaveLength(7); expect(r.filter(h => h.closed).map(h => h.day)).toEqual([0, 1]);
    expect(aplicarHorariosDaConversa([], [fechado([0, 1], "Os demais dias ficam fechados")], () => true)).toBeNull();
  });
  it("não aceita uma evidência ampla com dois expedientes diferentes sem associação por dia", () => {
    expect(aplicarHorariosDaConversa([], [aberto([2], "Terça das 9 às 18 e quarta das 10 às 17")], () => true)).toBeNull();
  });
});
