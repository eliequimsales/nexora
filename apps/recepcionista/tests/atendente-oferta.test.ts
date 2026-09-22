import { describe, expect, it } from "vitest";
import {
  escolherTres,
  formatarOpcao,
  lerEstado,
  opcoesParaEscolha,
  type Livre,
} from "@/lib/atendente/oferta";
import { quandoAtendeTexto, semanaDoAtendente } from "@/lib/atendente/semana";

/**
 * TRÊS HORÁRIOS DE VERDADE, MONTADOS POR CÓDIGO.
 *
 * A IA nunca escreve o bloco de horários: ele sai da agenda, numerado, e fica
 * guardado na conversa. É isso que deixa um "2" virar marcação sem modelo
 * nenhum no meio.
 */

const emBrasilia = (data: string, h: number, m = 0) => {
  const [a, mes, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, mes - 1, d, h + 3, m));
};

/** Horários de 30 em 30 minutos, das 9h às 18h30, nos dias informados. */
function grade(dias: string[], profissional: string | null = null): Livre[] {
  return dias.flatMap((dia) =>
    Array.from({ length: 20 }, (_, i) => {
      const inicio = emBrasilia(dia, 9, i * 30);
      return { inicio, fim: new Date(inicio.getTime() + 30 * 60_000), profissional };
    }),
  );
}

const hora = (l: Livre) => {
  const local = new Date(l.inicio.getTime() - 3 * 60 * 60_000);
  return `${local.getUTCDate()} ${local.getUTCHours()}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
};

describe("escolherTres", () => {
  it("espalha no dia: a primeira livre e as outras com folga de uma hora e meia", () => {
    const { opcoes, noDiaPedido } = escolherTres(grade(["2026-09-23", "2026-09-24"]), {});
    expect(opcoes.map(hora)).toEqual(["23 9:00", "23 10:30", "23 12:00"]);
    expect(noDiaPedido).toBe(true);
  });

  it("respeita o dia e o período pedidos", () => {
    const { opcoes } = escolherTres(grade(["2026-09-23", "2026-09-24"]), {
      dia: "2026-09-24",
      periodo: "TARDE",
    });
    expect(opcoes.map(hora)).toEqual(["24 12:00", "24 13:30", "24 15:00"]);
  });

  it("respeita o 'depois das 18h'", () => {
    const { opcoes } = escolherTres(grade(["2026-09-23"]), { aPartirDe: 18 * 60 });
    expect(opcoes.map(hora)).toEqual(["23 18:00", "23 18:30"]);
  });

  it("dia pedido sem vaga: oferece os próximos e avisa que não é o dia pedido", () => {
    const { opcoes, noDiaPedido } = escolherTres(grade(["2026-09-24"]), { dia: "2026-09-23" });
    expect(noDiaPedido).toBe(false);
    expect(opcoes[0] && hora(opcoes[0])).toBe("24 9:00");
  });

  it("período pedido sem vaga no dia: o mesmo período nos dias seguintes vem antes", () => {
    const horaLocal = (l: Livre) => new Date(l.inicio.getTime() - 3 * 60 * 60_000).getUTCHours();
    const soATarde23 = grade(["2026-09-23"]).filter((l) => horaLocal(l) >= 12);
    const livres = [...soATarde23, ...grade(["2026-09-24"])];
    const { opcoes, noDiaPedido } = escolherTres(livres, { dia: "2026-09-23", periodo: "MANHA" });
    expect(noDiaPedido).toBe(false);
    expect(opcoes.map(hora)[0]).toBe("24 9:00");
  });

  it("com poucos horários, completa sem exigir folga", () => {
    const tres = grade(["2026-09-23"]).slice(0, 3);
    expect(escolherTres(tres, {}).opcoes).toHaveLength(3);
  });

  it("sem horário nenhum, nenhuma opção", () => {
    expect(escolherTres([], {}).opcoes).toEqual([]);
  });
});

describe("formatarOpcao", () => {
  it("com e sem profissional", () => {
    const livre = { inicio: emBrasilia("2026-09-23", 9, 30), fim: emBrasilia("2026-09-23", 10), profissional: "Léo" };
    expect(formatarOpcao(1, livre)).toBe("1 · qua 23/09, 9h30 com Léo");
    expect(formatarOpcao(2, { ...livre, profissional: null })).toBe("2 · qua 23/09, 9h30");
  });
});

describe("lerEstado — a escolha guardada na conversa", () => {
  const agora = emBrasilia("2026-09-22", 22);
  const horario = {
    tipo: "HORARIO",
    servicoId: "s1",
    servicoNome: "Corte",
    duracaoMin: 40,
    opcoes: [{ n: 1, inicio: emBrasilia("2026-09-23", 11).toISOString(), fim: emBrasilia("2026-09-23", 11, 40).toISOString(), profissional: "Léo" }],
    criadoEm: new Date(agora.getTime() - 30 * 60_000).toISOString(),
  };

  it("lê uma oferta válida", () => {
    expect(lerEstado(horario, agora)?.tipo).toBe("HORARIO");
  });

  it("oferta de mais de duas horas venceu", () => {
    const velha = { ...horario, criadoEm: new Date(agora.getTime() - 3 * 60 * 60_000).toISOString() };
    expect(lerEstado(velha, agora)).toBeNull();
  });

  it("lixo não é estado", () => {
    expect(lerEstado({ tipo: "HORARIO", opcoes: "x" }, agora)).toBeNull();
    expect(lerEstado(null, agora)).toBeNull();
    expect(lerEstado("oi", agora)).toBeNull();
  });

  it("as opções de horário viram minutos locais para ler a escolha", () => {
    const estado = lerEstado(horario, agora)!;
    expect(opcoesParaEscolha(estado)).toEqual([{ n: 1, minutos: 11 * 60 }]);
  });
});

const HORARIOS = [
  { day: 0, open: "09:00", close: "19:00", closed: true },
  { day: 1, open: "09:00", close: "19:00", closed: false },
  { day: 2, open: "09:00", close: "19:00", closed: false },
  { day: 3, open: "09:00", close: "19:00", closed: false },
  { day: 4, open: "09:00", close: "19:00", closed: false },
  { day: 5, open: "18:00", close: "02:00", closed: false },
  { day: 6, open: "09:00", close: "14:00", closed: false },
];

describe("semanaDoAtendente — quem atende em cada faixa", () => {
  const semana = semanaDoAtendente(HORARIOS);

  it("começa na segunda e termina no domingo", () => {
    expect(semana.map((d) => d.nome)).toEqual(["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]);
  });

  it("dia normal: o Atendente antes e depois do expediente", () => {
    expect(semana[0].faixas).toEqual([
      { de: 0, ate: 540, quem: "ATENDENTE" },
      { de: 540, ate: 1140, quem: "VOCE" },
      { de: 1140, ate: 1440, quem: "ATENDENTE" },
    ]);
  });

  it("dia fechado: o Atendente o dia todo", () => {
    expect(semana[6].faixas).toEqual([{ de: 0, ate: 1440, quem: "ATENDENTE" }]);
  });

  it("expediente que vira a madrugada continua no dia seguinte", () => {
    expect(semana[4].faixas.at(-1)).toEqual({ de: 1080, ate: 1440, quem: "VOCE" });
    expect(semana[5].faixas[0]).toEqual({ de: 0, ate: 120, quem: "VOCE" });
  });
});

describe("quandoAtendeTexto — a semana em palavras", () => {
  it("junta os dias iguais", () => {
    const simples = HORARIOS.map((h) => (h.day === 5 ? { ...h, open: "09:00", close: "19:00" } : h));
    expect(quandoAtendeTexto(simples)).toEqual([
      "seg a sex: antes das 9h e depois das 19h",
      "sáb: antes das 9h e depois das 14h",
      "dom: o dia todo",
    ]);
  });
});
