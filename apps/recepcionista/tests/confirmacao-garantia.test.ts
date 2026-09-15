import { describe, expect, it } from "vitest";
import { montarConfirmacaoDaGarantia } from "@/lib/billing/confirmacao";
import { emReais } from "@/lib/billing/preco";

/**
 * O COMPROVANTE DA DEVOLUÇÃO.
 *
 * Quem pediu a garantia precisa saber, por escrito, quanto voltou, que nada mais
 * será cobrado e que a lista continua dele. Sem isso, o dono fica olhando a
 * fatura do cartão sem saber se o pedido deu certo.
 */

const BASE = { nome: "Barbearia do Zé", valorCents: 19_400 };

describe("montarConfirmacaoDaGarantia", () => {
  it("diz quanto foi devolvido", () => {
    expect(montarConfirmacaoDaGarantia(BASE).corpo).toContain(emReais(19_400));
  });

  it("deixa claro que nada mais será cobrado e que a lista continua dele", () => {
    const corpo = montarConfirmacaoDaGarantia(BASE).corpo.toLowerCase();
    expect(corpo).toContain("nada mais será cobrado");
    expect(corpo).toContain("exportar");
  });

  // O prazo do estorno é do banco, não da Nexora. Prometer "em 5 dias" e o banco
  // levar 10 transforma o comprovante numa promessa quebrada.
  it("não promete prazo de banco", () => {
    const corpo = montarConfirmacaoDaGarantia(BASE).corpo;
    expect(corpo).toContain("banco");
    expect(corpo).not.toMatch(/em até \d+ dias/);
  });

  it("sem nome, a saudação some inteira", () => {
    expect(montarConfirmacaoDaGarantia({ ...BASE, nome: "  " }).corpo.startsWith(",")).toBe(false);
  });
});
