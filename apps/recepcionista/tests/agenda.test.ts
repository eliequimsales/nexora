import { describe, expect, it } from "vitest";
import { calcularSlots, proximoRetornoProvavel, type Horario } from "@/lib/agenda/disponibilidade";

// Segunda-feira, 1 de junho de 2026.
const SEGUNDA = new Date("2026-06-01T00:00:00.000Z");
const DOMINGO = new Date("2026-06-07T00:00:00.000Z");

const comercial: Horario[] = [
  { day: 0, open: "09:00", close: "18:00", closed: true },
  { day: 1, open: "09:00", close: "12:00", closed: false },
  { day: 2, open: "09:00", close: "18:00", closed: false },
];

// Horário local de Brasília (UTC-3) escrito como instante UTC.
const local = (iso: string) => new Date(`${iso}-03:00`);

describe("calcularSlots", () => {
  const base = {
    horarios: comercial,
    duracaoMin: 30,
    ocupados: [],
    agora: local("2026-05-30T10:00:00"),
    offsetMinutos: -180,
  };

  it("gera os horários do dia respeitando abertura e fechamento", () => {
    const slots = calcularSlots({ ...base, dia: SEGUNDA });
    expect(slots[0]).toBe("09:00");
    expect(slots.at(-1)).toBe("11:30");
  });

  it("dia fechado não tem horário nenhum", () => {
    expect(calcularSlots({ ...base, dia: DOMINGO })).toEqual([]);
  });

  it("o atendimento tem que caber INTEIRO antes de fechar", () => {
    // Serviço de 45 min num expediente que fecha 12h: 11:30 não cabe.
    const slots = calcularSlots({ ...base, dia: SEGUNDA, duracaoMin: 45 });
    expect(slots).not.toContain("11:30");
    expect(slots.at(-1)).toBe("11:00");
  });

  it("remove horário que colide com agendamento existente", () => {
    const slots = calcularSlots({
      ...base,
      dia: SEGUNDA,
      ocupados: [
        { startsAt: local("2026-06-01T10:00:00"), endsAt: local("2026-06-01T10:30:00") },
      ],
    });
    expect(slots).not.toContain("10:00");
    expect(slots).toContain("09:30");
    expect(slots).toContain("10:30");
  });

  it("remove qualquer horário com sobreposição PARCIAL, não só coincidência exata", () => {
    // Agendamento das 10:15 às 10:45 derruba tanto o slot das 10:00 (que iria
    // até 10:30) quanto o das 10:30. Dupla marcação é o pior bug possível
    // numa agenda: o cliente aparece e não tem cadeira.
    const slots = calcularSlots({
      ...base,
      dia: SEGUNDA,
      ocupados: [
        { startsAt: local("2026-06-01T10:15:00"), endsAt: local("2026-06-01T10:45:00") },
      ],
    });
    expect(slots).not.toContain("10:00");
    expect(slots).not.toContain("10:30");
    expect(slots).toContain("09:30");
    expect(slots).toContain("11:00");
  });

  it("não oferece horário que já passou", () => {
    const slots = calcularSlots({
      ...base,
      dia: SEGUNDA,
      agora: local("2026-06-01T10:10:00"),
    });
    expect(slots).not.toContain("09:00");
    expect(slots).not.toContain("10:00");
    expect(slots).toContain("11:00");
  });

  it("respeita a antecedência mínima — ninguém marca para daqui a 5 minutos", () => {
    const slots = calcularSlots({
      ...base,
      dia: SEGUNDA,
      agora: local("2026-06-01T09:50:00"),
      antecedenciaMinutos: 60,
    });
    expect(slots).not.toContain("10:00");
    expect(slots).not.toContain("10:30");
    expect(slots).toContain("11:00");
  });

  it("um dia inteiro no passado não oferece nada", () => {
    const slots = calcularSlots({
      ...base,
      dia: SEGUNDA,
      agora: local("2026-06-02T09:00:00"),
    });
    expect(slots).toEqual([]);
  });

  it("o passo dos horários pode ser configurado", () => {
    const slots = calcularSlots({ ...base, dia: SEGUNDA, passoMin: 60 });
    expect(slots).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"].filter((h) =>
      ["09:00", "10:00", "11:00"].includes(h),
    ));
  });

  it("sem configuração para aquele dia da semana, o dia é tratado como fechado", () => {
    const slots = calcularSlots({ ...base, dia: new Date("2026-06-05T00:00:00.000Z") });
    expect(slots).toEqual([]);
  });
});

describe("proximoRetornoProvavel", () => {
  it("soma o ciclo pessoal à última visita — vira a mensagem de fim de atendimento", () => {
    // "Seu próximo costuma cair por volta de [data], já quer deixar marcado?"
    // É a intervenção de maior retorno do produto: agenda o retorno enquanto o
    // cliente ainda está satisfeito, e impede o estoque de se formar de novo.
    const data = proximoRetornoProvavel(local("2026-06-01T10:00:00"), 24);
    expect(data.toISOString().slice(0, 10)).toBe("2026-06-25");
  });
});
