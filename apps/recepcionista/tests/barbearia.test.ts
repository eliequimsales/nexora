import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A PÁGINA DE BARBEARIA.
 *
 * Página de nicho é onde a tentação de inventar prova social é maior — "mais de
 * 500 barbearias usam", depoimento de barbeiro que não existe. Esta fala com o
 * barbeiro usando o que o produto tem: o ritmo de barbearia que o motor usa, a
 * conta com os números dele e a mesma oferta da home.
 */

const RAIZ = join(__dirname, "..");
const ARQUIVO = "app/barbearia/page.tsx";
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const pagina = () => semComentarios(readFileSync(join(RAIZ, ARQUIVO), "utf8"));
const semQuebras = (s: string) => s.replace(/\s+/g, " ");

describe("/barbearia", () => {
  it("existe e fala com o barbeiro", () => {
    expect(existsSync(join(RAIZ, ARQUIVO))).toBe(true);
    expect(pagina()).toMatch(/title:\s*"[^"]*[Bb]arbearia/);
  });

  it("a calculadora e o diagnóstico usam o ritmo de barbearia do motor", () => {
    expect(pagina()).toContain('<Calculadora ramo="barbearia"');
    expect(pagina()).toContain("/diagnostico?ramo=barbearia");
    expect(pagina()).toContain("MEDIANA_POR_SEGMENTO.barbearia");
  });

  it("a oferta, a garantia e as perguntas saem das mesmas fontes da home", () => {
    expect(pagina()).toContain("GARANTIA_DIAS");
    expect(pagina()).toContain("PERGUNTAS_FREQUENTES");
  });

  it("tem o rodapé do funil", () => {
    expect(pagina()).toContain("<RodapeFunil");
  });

  it("não inventa depoimento, número de clientes nem resultado", () => {
    const texto = semQuebras(pagina()).toLowerCase();
    expect(texto).not.toContain("depoimento");
    expect(texto).not.toMatch(/\+\s?\d+\s*(barbearias|clientes|negócios)/);
    expect(texto).not.toMatch(/mais de \d+/);
    expect(texto).not.toMatch(/barbearias (já )?usam/);
  });

  it("todo link leva a algum lugar que existe", () => {
    for (const [, rota] of pagina().matchAll(/href="(\/[\w\-/]*)(?:[?#][^"]*)?"/g)) {
      const destino = rota === "/" ? "app/page.tsx" : `app${rota}/page.tsx`;
      expect(existsSync(join(RAIZ, destino)), rota).toBe(true);
    }
  });
});
