import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { JANELA_DIAS, MIN_RECUPERAVEL_CENTS } from "@/lib/recuperacao/estimativa";
import { custoVsRetorno } from "@/lib/recuperacao/custo-vs-retorno";

/**
 * O QUE A NEXORA CUSTA VS. O QUE ELA TRAZ.
 *
 * Veio da Nexora antiga, que dividia um "potencial recuperado" inventado (30% que
 * somem, 20% que voltam) pelo preço. Aqui o retorno é a faixa que o diagnóstico
 * calculou com a lista do dono, e o custo é o que ele pagaria na mesma janela
 * dessa faixa.
 *
 * Desde os Termos de 2026-09-15 conta nova não tem mês grátis. Continuar
 * descontando um mostraria o custo menor do que ele é, justamente no bloco que
 * decide a compra.
 */

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(__dirname, "..", rel), "utf8"));

describe("o custo da Nexora na janela da estimativa", () => {
  it("são as mensalidades dos 90 dias, todas pagas", () => {
    const c = custoVsRetorno({ min: 216_000, max: 360_000 });
    expect(c.mesesNaJanela).toBe(3);
    expect(c.mesesPagos).toBe(3);
    expect(c.custoCents).toBe(29_100);
  });

  it("sai das constantes do preço e da janela, sem mês grátis", () => {
    const c = custoVsRetorno({ min: 0, max: 0 });
    expect(c.mesesNaJanela).toBe(Math.round(JANELA_DIAS / 30));
    expect(c.mesesPagos).toBe(c.mesesNaJanela);
    expect(c.custoCents).toBe(c.mesesPagos * PRECO_MENSAL_CENTS);
    expect(c).not.toHaveProperty("mesesGratis");
  });
});

describe("quantas vezes o retorno cobre o custo", () => {
  it("usa o cenário mais baixo e arredonda para baixo", () => {
    // 2.160 / 291 = 7,42… — mostrar 7,5 seria arredondar a favor da venda.
    const c = custoVsRetorno({ min: 216_000, max: 360_000 });
    expect(c.vezesNoMinimo).toBe(7.4);
    expect(c.cobreNoMinimo).toBe(true);
  });

  it("retorno abaixo do custo é dito como não cobre", () => {
    const c = custoVsRetorno({ min: 10_000, max: 16_000 });
    expect(c.vezesNoMinimo).toBe(0.3);
    expect(c.cobreNoMinimo).toBe(false);
  });

  it("quem passa do corte honesto sempre cobre o custo", () => {
    // Se o preço subir a ponto de o custo passar do corte de R$ 500, este teste
    // avisa: o bloco diria "não cobre" para quem o diagnóstico mandou comprar.
    expect(
      custoVsRetorno({ min: MIN_RECUPERAVEL_CENTS, max: MIN_RECUPERAVEL_CENTS }).cobreNoMinimo,
    ).toBe(true);
  });
});

describe("a tela não escreve preço nem janela à mão", () => {
  it("o bloco usa as constantes e não fala em mês grátis", () => {
    const bloco = leia("components/diagnostico/custo-vs-retorno.tsx");
    for (const literal of ["97", "291", "90 dias", "30 dias", "grátis"]) {
      expect(bloco, literal).not.toContain(literal);
    }
    expect(bloco).toMatch(/from\s+["']@\/lib\/recuperacao\/custo-vs-retorno["']/);
  });

  it("o resultado do diagnóstico mostra o bloco antes do botão de criar conta", () => {
    const painel = leia("app/diagnostico/painel.tsx");
    const bloco = painel.indexOf("<CustoVsRetorno");
    const botao = painel.indexOf("Criar minha conta e trazer esses");
    expect(bloco).toBeGreaterThan(-1);
    expect(bloco).toBeLessThan(botao);
  });

  it("o preço perto do botão sai da constante", () => {
    expect(leia("app/diagnostico/painel.tsx")).not.toContain("R$ 97");
  });
});
