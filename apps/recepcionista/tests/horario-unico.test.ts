import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HORARIO_PADRAO, horarioDaEmpresa, semanaCompleta } from "@/lib/agenda/horario";
import { calcularSlots } from "@/lib/agenda/disponibilidade";
import { isOpenNow } from "@/lib/ai/prompt";

/**
 * O HORÁRIO DA EMPRESA MORA NUM LUGAR SÓ.
 *
 * A página de agendar assumia 8h às 20h quando o dono não tinha cadastrado
 * horário, e o atendimento assumia "sempre aberto". Com o Plantão, que só
 * responde com a loja fechada, "sempre aberto" viraria "nunca atende".
 */

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

// Terça, 22/09/2026, em Brasília (UTC-3).
const TERCA_22H = new Date("2026-09-23T01:00:00.000Z");
const TERCA_10H = new Date("2026-09-22T13:00:00.000Z");

describe("o horário da empresa", () => {
  it("sem horário cadastrado, vale o padrão da página de agendar", () => {
    expect(horarioDaEmpresa([])).toEqual(HORARIO_PADRAO);
    expect(horarioDaEmpresa(null)).toEqual(HORARIO_PADRAO);
    expect(horarioDaEmpresa("lixo")).toEqual(HORARIO_PADRAO);
  });

  it("o padrão tem os sete dias, com o domingo fechado", () => {
    expect(HORARIO_PADRAO.map((h) => h.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(HORARIO_PADRAO[0].closed).toBe(true);
    expect(HORARIO_PADRAO[6]).toMatchObject({ open: "08:00", close: "19:00", closed: false });
  });

  it("com horário cadastrado, vale o cadastrado", () => {
    const meu = [{ day: 2, open: "09:00", close: "19:00", closed: false }];
    expect(horarioDaEmpresa(meu)).toEqual(meu);
  });

  it("closed ausente é dia aberto, como a agenda sempre leu", () => {
    expect(horarioDaEmpresa([{ day: 2, open: "09:00", close: "19:00" }])).toEqual([
      { day: 2, open: "09:00", close: "19:00", closed: false },
    ]);
  });

  it("descarta entrada inválida e, se nada sobrar, volta ao padrão", () => {
    expect(horarioDaEmpresa([{ day: 9, open: "25:00", close: "x" }])).toEqual(HORARIO_PADRAO);
    expect(
      horarioDaEmpresa([{ day: 2, open: "09:00", close: "19:00", closed: false }, { day: "x" }]),
    ).toHaveLength(1);
  });

  it("devolve cópia: mexer no resultado não muda o padrão", () => {
    const h = horarioDaEmpresa([]);
    h[1].open = "03:00";
    expect(HORARIO_PADRAO[1].open).toBe("08:00");
  });

  it("a semana completa mostra como fechado o dia que não aparece", () => {
    const semana = semanaCompleta([{ day: 2, open: "09:00", close: "19:00", closed: false }]);
    expect(semana).toHaveLength(7);
    expect(semana[2]).toEqual({ day: 2, open: "09:00", close: "19:00", closed: false });
    expect(semana[3].closed).toBe(true);
  });
});

describe("agenda e atendimento concordam", () => {
  it("sem horário cadastrado, terça às 22h está fechado e às 10h está aberto", () => {
    const horas = horarioDaEmpresa([]);
    expect(isOpenNow(horas, TERCA_22H)).toBe(false);
    expect(isOpenNow(horas, TERCA_10H)).toBe(true);
  });

  it("e a página de agendar oferece exatamente o mesmo expediente", () => {
    const slots = calcularSlots({
      dia: new Date("2026-09-22T00:00:00.000Z"),
      horarios: horarioDaEmpresa([]),
      duracaoMin: 30,
      ocupados: [],
      agora: new Date("2026-09-21T12:00:00.000Z"),
    });
    expect(slots[0]).toBe("08:00");
    expect(slots.at(-1)).toBe("19:30");
  });
});

describe("ninguém inventa o próprio padrão", () => {
  it("a página de agendar lê o horário daqui", () => {
    const rota = leia("app/api/agendar/[slug]/route.ts");
    expect(rota).toContain("horarioDaEmpresa(");
    expect(rota).not.toContain("HORARIOS_PADRAO");
  });

  it("o Atendente lê o horário daqui", () => {
    for (const arquivo of ["lib/atendente/executar.ts", "lib/atendente/fatos.ts"]) {
      const fonte = leia(arquivo);
      expect(fonte, arquivo).toContain("horarioDaEmpresa(");
      expect(fonte, arquivo).not.toMatch(/function asBusinessHours/);
    }
  });

  it("a tela de configurações mostra o horário que vale de verdade", () => {
    const tela = leia("app/painel/configuracoes/page.tsx");
    expect(tela).toContain("HORARIO_PADRAO");
    expect(tela).toContain("horarioDaEmpresa(");
  });
});
