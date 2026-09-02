import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JANELA_DIAS, MULTIPLO_DO_CICLO, ehAtribuivel } from "@/lib/recuperacao/atribuicao";

/**
 * ATRIBUIÇÃO — a regra que o produto afirmava aplicar e não aplicava.
 *
 * `RecoveryEntry.attributed` está `@default(true)` no schema, e a rota da Onda
 * nunca passa o campo. Ou seja: TODO retorno era contado como recuperado pela
 * Nexora, inclusive o cliente que ia voltar de qualquer jeito.
 *
 * Enquanto isso, /painel/assinatura afirma na tela que existe "janela de
 * atribuição de 21 dias", e o comentário do schema descreve a regra completa.
 * É a mesma falha que aparece em todo lugar deste produto: a tela afirmando o
 * que o código não faz.
 *
 * E aqui dói mais que nos outros casos, porque o número inflado é a NORTH STAR.
 * Um Livro-Caixa menor e defensável vale mais na renovação do que um maior que
 * o dono não consegue explicar para si mesmo.
 */

describe("as constantes são as que a tela promete", () => {
  it("a janela é de 21 dias", () => {
    expect(JANELA_DIAS).toBe(21);
  });

  it("o cliente precisa estar além de 1,5x o ciclo dele", () => {
    expect(MULTIPLO_DO_CICLO).toBe(1.5);
  });
});

describe("o que conta como recuperado pela Nexora", () => {
  const base = { diasDesdeOToque: 5, diasSumido: 60, cicloDias: 30 };

  it("voltou logo depois do toque, e estava mesmo sumido: conta", () => {
    expect(ehAtribuivel(base)).toBe(true);
  });

  it("voltou no último dia da janela: ainda conta", () => {
    expect(ehAtribuivel({ ...base, diasDesdeOToque: 21 })).toBe(true);
  });

  it("voltou depois da janela: não conta", () => {
    // 22 dias depois, a mensagem já não é a explicação mais provável.
    expect(ehAtribuivel({ ...base, diasDesdeOToque: 22 })).toBe(false);
  });

  it("estava dentro do ritmo dele: não conta, mesmo respondendo ao toque", () => {
    // Ciclo de 30 dias, sumido há 40: ele voltaria sozinho. Contar isso como
    // recuperação é cobrar pelo que ia acontecer de qualquer jeito.
    expect(ehAtribuivel({ diasDesdeOToque: 3, diasSumido: 40, cicloDias: 30 })).toBe(false);
  });

  it("exatamente 1,5x o ciclo ainda não conta — precisa passar", () => {
    expect(ehAtribuivel({ diasDesdeOToque: 3, diasSumido: 45, cicloDias: 30 })).toBe(false);
    expect(ehAtribuivel({ diasDesdeOToque: 3, diasSumido: 46, cicloDias: 30 })).toBe(true);
  });

  it("sem ciclo confiável, não atribui", () => {
    // Sem saber o ritmo dele, não dá para afirmar que ele não voltaria sozinho.
    // Na dúvida o número fica MENOR, nunca maior.
    expect(ehAtribuivel({ diasDesdeOToque: 3, diasSumido: 200, cicloDias: 0 })).toBe(false);
  });

  it("toque no futuro é dado corrompido, não atribui", () => {
    expect(ehAtribuivel({ diasDesdeOToque: -1, diasSumido: 200, cicloDias: 30 })).toBe(false);
  });
});

describe("a rota da Onda passa a calcular o campo", () => {
  const rota = readFileSync(
    join(__dirname, "..", "app/api/onda/route.ts"),
    "utf8",
  );

  it("não deixa mais cair no @default(true)", () => {
    expect(rota).toContain("ehAtribuivel");
    expect(rota).toMatch(/attributed:/);
  });
});
