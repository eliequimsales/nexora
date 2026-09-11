import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FAIXA_EM_TEXTO,
  JANELA_DIAS,
  MAX_VISITAS_PROJETADAS,
  MIN_RECUPERAVEL_CENTS,
  MIN_SUMIDOS,
  TAXA_MAX,
  TAXA_MIN,
  abaixoDoCorte,
  faixaRecuperavel,
  visitasNaJanela,
} from "@/lib/recuperacao/estimativa";

/**
 * A CONTA DO DINHEIRO RECUPERÁVEL MORA NUM LUGAR SÓ.
 *
 * A calculadora da home e o diagnóstico dizem ao dono quanto dinheiro está
 * parado. Com uma fórmula em cada tela, bastava ajustar a taxa num lugar para a
 * home prometer um valor e o diagnóstico mostrar outro para a mesma base.
 */

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("a regra", () => {
  it("são as taxas, a janela e os limites que o diagnóstico sempre usou", () => {
    expect(TAXA_MIN).toBe(0.15);
    expect(TAXA_MAX).toBe(0.25);
    expect(JANELA_DIAS).toBe(90);
    expect(MAX_VISITAS_PROJETADAS).toBe(4);
    expect(MIN_SUMIDOS).toBe(25);
    expect(MIN_RECUPERAVEL_CENTS).toBe(50_000);
  });

  it("o texto da faixa sai das taxas", () => {
    expect(FAIXA_EM_TEXTO).toBe("15% a 25%");
  });
});

describe("visitas na janela de 90 dias", () => {
  it("quem volta a cada 30 dias volta 3 vezes", () => {
    expect(visitasNaJanela(30)).toBe(3);
  });

  it("arredonda: 24 dias dá 4 visitas", () => {
    expect(visitasNaJanela(24)).toBe(4);
  });

  it("nunca menos de 1: ciclo de 180 dias ainda conta a volta", () => {
    expect(visitasNaJanela(180)).toBe(1);
  });

  it("nunca mais de 4: ciclo semanal não vira 13 idas seguidas", () => {
    expect(visitasNaJanela(7)).toBe(4);
    expect(visitasNaJanela(0)).toBe(4);
  });
});

describe("faixa recuperável", () => {
  it("15% e 25% do potencial, com a média no meio", () => {
    expect(faixaRecuperavel(5_400_000)).toEqual({ min: 810_000, central: 1_080_000, max: 1_350_000 });
  });

  it("potencial zero é faixa zero", () => {
    expect(faixaRecuperavel(0)).toEqual({ min: 0, central: 0, max: 0 });
  });
});

describe("corte honesto", () => {
  it("menos de 25 sumidos fica abaixo do corte", () => {
    expect(abaixoDoCorte(24, 1_000_000)).toBe(true);
  });

  it("25 sumidos com R$ 500 no mínimo passa", () => {
    expect(abaixoDoCorte(25, 50_000)).toBe(false);
  });

  it("um centavo abaixo de R$ 500 fica abaixo do corte", () => {
    expect(abaixoDoCorte(25, 49_999)).toBe(true);
  });
});

describe("o diagnóstico usa esta conta, e não uma cópia", () => {
  const fonte = semComentarios(
    readFileSync(join(__dirname, "..", "lib/importacao/diagnostico.ts"), "utf8"),
  );

  it("importa a fórmula de lib/recuperacao/estimativa", () => {
    expect(fonte).toMatch(/from\s+["']@\/lib\/recuperacao\/estimativa["']/);
  });

  it("não declara as próprias taxas nem limites", () => {
    for (const nome of [
      "TAXA_MIN",
      "TAXA_MAX",
      "JANELA_DIAS",
      "MAX_VISITAS_PROJETADAS",
      "MIN_SUMIDOS",
      "MIN_RECUPERAVEL_CENTS",
    ]) {
      expect(fonte, nome).not.toMatch(new RegExp(`const\\s+${nome}\\s*=`));
    }
  });

  it("não escreve a faixa nem a janela à mão", () => {
    expect(fonte).not.toContain("15% a 25%");
    expect(fonte).not.toMatch(/\b90 dias\b/);
  });
});
