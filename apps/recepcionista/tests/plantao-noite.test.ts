import { describe, expect, it } from "vitest";
import {
  calcularGatilhoDaNoite,
  formatarMomentoDaNoite,
  type MensagemClienteNoite,
} from "@/lib/plantao/noite";
import type { BusinessHour } from "@/lib/validation";

/**
 * GATILHO DA NOITE (Fase 0 do Plantão)
 *
 * Mede as mensagens recebidas fora do horário de funcionamento.
 * Acompanha a esteira comercial aprovada pelo fundador.
 */

const HORARIOS_PADRAO: BusinessHour[] = [
  { day: 0, open: "08:00", close: "18:00", closed: true }, // domingo fechado
  { day: 1, open: "08:00", close: "18:00", closed: false }, // seg 8h às 18h
  { day: 2, open: "08:00", close: "18:00", closed: false },
  { day: 3, open: "08:00", close: "18:00", closed: false },
  { day: 4, open: "08:00", close: "18:00", closed: false },
  { day: 5, open: "08:00", close: "18:00", closed: false },
  { day: 6, open: "08:00", close: "14:00", closed: false }, // sab 8h às 14h
];

describe("formatarMomentoDaNoite", () => {
  it("formata sábado à noite corretamente", () => {
    // 2026-09-26T21:12:00 em Brasília (UTC-3 = 2026-09-27T00:12:00Z)
    const sabado = new Date("2026-09-27T00:12:00.000Z");
    const texto = formatarMomentoDaNoite(sabado);
    expect(texto).toContain("sábado");
    expect(texto).toContain("21h12");
  });

  it("remove o sufixo -feira dos dias da semana", () => {
    // 2026-09-22T23:00:00 em Brasília (UTC-3 = 2026-09-23T02:00:00Z)
    const terca = new Date("2026-09-23T02:00:00.000Z");
    const texto = formatarMomentoDaNoite(terca);
    expect(texto).toContain("terça");
    expect(texto).not.toContain("-feira");
  });
});

describe("calcularGatilhoDaNoite", () => {
  it("sem WhatsApp conectado, devolve o exemplo pedagógico do documento", () => {
    const res = calcularGatilhoDaNoite({
      mensagens: [],
      horarios: HORARIOS_PADRAO,
      diasFechados: [],
      whatsappConectado: false,
      semana: 3,
    });

    expect(res.ehExemplo).toBe(true);
    expect(res.whatsappConectado).toBe(false);
    expect(res.totalForaDoHorario).toBe(9);
    expect(res.semResposta).toBe(4);
    expect(res.maisAntiga?.nome).toBe("Rafael");
    expect(res.maisAntiga?.quandoTexto).toBe("sábado às 21h12");
    expect(res.semana).toBe(3);
  });

  it("com WhatsApp conectado, filtra mensagens da noite e identifica não respondidas", () => {
    // Terça 10h da manhã (dentro do expediente)
    const tercaExpediente = new Date("2026-09-22T13:00:00.000Z");
    // Terça 22h (fora do expediente)
    const tercaNoite = new Date("2026-09-23T01:00:00.000Z");
    // Quarta 03h (fora do expediente)
    const quartaMadrugada = new Date("2026-09-23T06:00:00.000Z");

    const msgs: MensagemClienteNoite[] = [
      {
        id: "1",
        clienteNome: "Ana",
        clienteTelefone: "5511999990001",
        recebidaEm: tercaExpediente,
        respondida: false,
      },
      {
        id: "2",
        clienteNome: "Bruno",
        clienteTelefone: "5511999990002",
        recebidaEm: tercaNoite,
        respondida: true,
      },
      {
        id: "3",
        clienteNome: "Carlos",
        clienteTelefone: "5511999990003",
        recebidaEm: quartaMadrugada,
        respondida: false,
      },
    ];

    const res = calcularGatilhoDaNoite({
      mensagens: msgs,
      horarios: HORARIOS_PADRAO,
      diasFechados: [],
      whatsappConectado: true,
      semana: 2,
    });

    expect(res.ehExemplo).toBe(false);
    expect(res.whatsappConectado).toBe(true);
    // Apenas mensagens 2 e 3 foram fora do expediente
    expect(res.totalForaDoHorario).toBe(2);
    // Apenas mensagem 3 não foi respondida
    expect(res.semResposta).toBe(1);
    expect(res.maisAntiga?.nome).toBe("Carlos");
  });

  it("dias fechados contam o dia inteiro como fora do horário", () => {
    // 2026-09-22 (terça-feira) durante o dia
    const tercaDia = new Date("2026-09-22T15:00:00.000Z");

    const msgs: MensagemClienteNoite[] = [
      {
        id: "1",
        clienteNome: "Daniel",
        clienteTelefone: "5511999990004",
        recebidaEm: tercaDia,
        respondida: false,
      },
    ];

    const res = calcularGatilhoDaNoite({
      mensagens: msgs,
      horarios: HORARIOS_PADRAO,
      diasFechados: ["2026-09-22"], // dia fechado extraordinariamente
      whatsappConectado: true,
    });

    expect(res.totalForaDoHorario).toBe(1);
    expect(res.semResposta).toBe(1);
    expect(res.maisAntiga?.nome).toBe("Daniel");
  });
});
