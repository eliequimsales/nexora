import { describe, expect, it } from "vitest";
import { montarConfirmacaoDoPasse } from "@/lib/billing/confirmacao";
import { emReais } from "@/lib/billing/preco";
import { VERSAO_DOCUMENTOS } from "@/lib/legal/identidade";

/**
 * A CONFIRMAÇÃO DO PASSE — Decreto 7.962/2013, art. 4º, V.
 *
 * Pagar 30 dias no Pix ou 12 meses à vista também é aceitar uma oferta, e o
 * decreto manda confirmar. O e-mail da assinatura não serve: ele fala em cartão
 * cadastrado e cobrança todo mês, e aqui não existe nem um nem outro. Dizer isso
 * para quem pagou no Pix seria o comprovante mentindo sobre o que foi comprado.
 */

const BASE = {
  nome: "Barbearia do Zé",
  dias: 30,
  valorCents: 9_700,
  fim: new Date("2026-10-15T15:00:00.000Z"),
};

describe("montarConfirmacaoDoPasse", () => {
  it("diz o que foi pago, quanto e até quando vale", () => {
    const { corpo } = montarConfirmacaoDoPasse(BASE);
    expect(corpo).toContain(emReais(9_700));
    expect(corpo).toContain("30 dias");
    expect(corpo).toContain("15/10/2026");
  });

  it("o anual aparece como 12 meses", () => {
    expect(montarConfirmacaoDoPasse({ ...BASE, dias: 365, valorCents: 97_000 }).corpo).toContain(
      "12 meses",
    );
  });

  it("deixa claro que não há cobrança automática", () => {
    expect(montarConfirmacaoDoPasse(BASE).corpo.toLowerCase()).toContain(
      "não há cobrança automática",
    );
  });

  it("não fala em cartão cadastrado nem em cobrança todo mês", () => {
    const corpo = montarConfirmacaoDoPasse(BASE).corpo.toLowerCase();
    expect(corpo).not.toContain("cartão cadastrado");
    expect(corpo).not.toContain("todo mês");
  });

  it("informa o arrependimento de 7 dias do CDC", () => {
    const { corpo } = montarConfirmacaoDoPasse(BASE);
    expect(corpo).toContain("art. 49");
    expect(corpo).toContain("7 dias");
  });

  it("identifica quem presta o serviço e a versão dos documentos", () => {
    const { corpo } = montarConfirmacaoDoPasse(BASE);
    expect(corpo).toContain("Quem está prestando o serviço");
    expect(corpo).toContain(VERSAO_DOCUMENTOS);
  });

  it("sem nome, a saudação some inteira", () => {
    expect(montarConfirmacaoDoPasse({ ...BASE, nome: "  " }).corpo.startsWith(",")).toBe(false);
  });
});
