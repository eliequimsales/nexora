import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { percorrerFila, type FilaDeContas } from "@/lib/reengajamento/fila";

/**
 * A RÉGUA LIA SEMPRE AS MESMAS 40 CONTAS.
 *
 * `rodarRegua` buscava `take: 40` ordenado por data de criação, sem cursor e
 * sem marca de quem já tinha sido avaliado. Toda execução devolvia as 40 contas
 * mais antigas, e da 41ª em diante ninguém recebia e-mail nenhum — nem o aviso
 * de que o teste grátis ia acabar, nem o de carrinho abandonado dos leads que
 * as campanhas trazem.
 *
 * A régua roda dentro de uma requisição com tempo contado, junto com a chamada
 * de segunda. Por isso a correção não é "buscar tudo": é uma fila justa. Cada
 * execução avalia primeiro quem esperou mais, marca quem avaliou e para quando
 * o orçamento de tempo acaba. A próxima começa por quem ficou de fora.
 */

type Conta = { id: string; avaliadaEm: Date | null };

const INICIO = new Date("2026-09-15T09:00:00.000Z");
const SEM_PRESSA = { inicio: INICIO, tamanhoDoLote: 40, orcamentoMs: 60_000 };

function baseDe(n: number): Conta[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${String(i + 1).padStart(4, "0")}`,
    avaliadaEm: null,
  }));
}

/**
 * Banco de mentira com a MESMA regra da consulta real: fora quem já foi avaliado
 * nesta execução; primeiro quem nunca foi avaliado, depois quem espera há mais
 * tempo, e o id desempata.
 */
function filaSobre(
  contas: Conta[],
  avaliar: (c: Conta) => Promise<void> = async () => {},
  falhas: Conta[] = [],
): FilaDeContas<Conta> {
  return {
    buscarLote: async (inicio, tamanho) =>
      contas
        .filter((c) => c.avaliadaEm === null || c.avaliadaEm.getTime() < inicio.getTime())
        .sort((a, b) => {
          if (a.avaliadaEm === null && b.avaliadaEm !== null) return -1;
          if (a.avaliadaEm !== null && b.avaliadaEm === null) return 1;
          const t = (a.avaliadaEm?.getTime() ?? 0) - (b.avaliadaEm?.getTime() ?? 0);
          return t !== 0 ? t : a.id.localeCompare(b.id);
        })
        .slice(0, tamanho)
        .map((c) => ({ ...c })),
    avaliar,
    aoFalhar: async (c) => {
      falhas.push(c);
    },
    marcarAvaliada: async (c, inicio) => {
      const real = contas.find((x) => x.id === c.id);
      if (real) real.avaliadaEm = inicio;
    },
  };
}

describe("percorrerFila", () => {
  it("avalia todas as contas, e não só as 40 primeiras", async () => {
    const contas = baseDe(95);
    const avaliadas: string[] = [];
    const r = await percorrerFila(
      filaSobre(contas, async (c) => {
        avaliadas.push(c.id);
      }),
      SEM_PRESSA,
    );

    expect(r).toEqual({ processadas: 95, esgotouOrcamento: false });
    expect(new Set(avaliadas).size).toBe(95);
    expect(avaliadas).toContain("c0041");
  });

  it("base vazia termina sem avaliar nada", async () => {
    expect(await percorrerFila(filaSobre([]), SEM_PRESSA)).toEqual({
      processadas: 0,
      esgotouOrcamento: false,
    });
  });

  // Um Resend fora do ar numa conta não pode deixar as outras sem e-mail, nem
  // prender a fila na mesma conta para sempre.
  it("uma conta que falha é marcada e não trava a fila", async () => {
    const contas = baseDe(5);
    const falhas: Conta[] = [];
    const r = await percorrerFila(
      filaSobre(
        contas,
        async (c) => {
          if (c.id === "c0003") throw new Error("Resend fora do ar");
        },
        falhas,
      ),
      SEM_PRESSA,
    );

    expect(r.processadas).toBe(5);
    expect(falhas.map((c) => c.id)).toEqual(["c0003"]);
    expect(contas.every((c) => c.avaliadaEm !== null)).toBe(true);
  });

  it("quando o tempo acaba, a próxima execução começa por quem ficou de fora", async () => {
    const contas = baseDe(30);
    let agora = 0;
    const relogio = () => agora;

    const hoje: string[] = [];
    const r1 = await percorrerFila(
      filaSobre(contas, async (c) => {
        hoje.push(c.id);
        agora += 1_000;
      }),
      { inicio: INICIO, tamanhoDoLote: 40, orcamentoMs: 10_000, relogio },
    );
    expect(r1).toEqual({ processadas: 10, esgotouOrcamento: true });

    agora = 0;
    const amanha: string[] = [];
    await percorrerFila(
      filaSobre(contas, async (c) => {
        amanha.push(c.id);
        agora += 1_000;
      }),
      { inicio: new Date(INICIO.getTime() + 86_400_000), tamanhoDoLote: 40, orcamentoMs: 10_000, relogio },
    );

    const quemFicouDeFora = contas.map((c) => c.id).filter((id) => !hoje.includes(id));
    expect(amanha).toEqual(quemFicouDeFora.slice(0, 10));
  });

  it("fila que não avança é interrompida em vez de rodar para sempre", async () => {
    const semMarcar: FilaDeContas<Conta> = {
      ...filaSobre(baseDe(3)),
      marcarAvaliada: async () => {},
    };
    await expect(
      percorrerFila(semMarcar, { inicio: INICIO, tamanhoDoLote: 2, orcamentoMs: 60_000 }),
    ).rejects.toThrow("não avançou");
  });
});

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

describe("a régua usa a fila justa", () => {
  const servico = leia("lib/reengajamento/servico.ts");

  it("percorre a fila em vez de um lote fixo", () => {
    expect(servico).toContain("percorrerFila(");
    expect(servico).not.toMatch(/orderBy:\s*\{\s*createdAt:\s*"asc"\s*\},\s*take:\s*LOTE/);
  });

  it("busca primeiro quem nunca foi avaliado e depois quem espera há mais tempo", () => {
    expect(servico).toMatch(/reguaAvaliadaEm:\s*\{\s*sort:\s*"asc",\s*nulls:\s*"first"\s*\}/);
  });

  it("o schema guarda quando a conta foi avaliada", () => {
    expect(readFileSync(join(RAIZ, "prisma/schema.prisma"), "utf8")).toMatch(
      /reguaAvaliadaEm\s+DateTime\?/,
    );
  });
});

describe("a chamada de segunda não repete a mesma janela", () => {
  const chamada = leia("lib/reengajamento/chamada-semanal.ts");

  // O teto de 300 com `orderBy: id` devolvia sempre as mesmas 300 contas: quem
  // já tinha recebido na semana continuava ocupando a janela de quem não recebeu.
  it("tira da busca quem já recebeu nesta semana", () => {
    expect(chamada).toMatch(/reengajamentos:\s*\{\s*none:\s*\{\s*momento\s*\}\s*\}/);
  });

  it("tira da busca quem não tem lista para chamar", () => {
    expect(chamada).toMatch(/customers:\s*\{\s*some:\s*\{\s*optOut:\s*false\s*\}\s*\}/);
  });
});
