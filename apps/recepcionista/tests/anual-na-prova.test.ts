import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  JANELA_DA_PROVA_DIAS,
  MENSALIDADES_DA_PROVA,
  ofertaDoAnual,
} from "@/lib/billing/anual-na-prova";
import { emReais, PRECO_ANUAL_CENTS, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";

/**
 * O ANUAL NO MOMENTO DA PROVA.
 *
 * O anual aparece para quem paga mês a mês quando o Dinheiro recuperado dos
 * últimos 30 dias passa de três mensalidades. No Pix, o ano começa quando os
 * dias pagos acabam; no cartão, a troca é feita com a gente, para ninguém pagar
 * duas vezes pelos mesmos dias.
 */

const PROVA = MENSALIDADES_DA_PROVA * PRECO_MENSAL_CENTS;
const SUPORTE = "https://wa.me/5511988887777?text=Oi";

describe("ofertaDoAnual", () => {
  it("abaixo de três mensalidades recuperadas, não aparece", () => {
    expect(
      ofertaDoAnual({
        estado: "PASSE",
        comoPaga: "PIX_30",
        recuperado30dCents: PROVA - 1,
        suporte: SUPORTE,
      }),
    ).toBeNull();
  });

  it("Pix de 30 dias: pagar o ano, que começa depois dos dias pagos", () => {
    const o = ofertaDoAnual({
      estado: "PASSE",
      comoPaga: "PIX_30",
      recuperado30dCents: PROVA,
      suporte: SUPORTE,
    });
    expect(o?.titulo).toContain(emReais(PROVA));
    expect(o?.titulo).toContain(`${JANELA_DA_PROVA_DIAS} dias`);
    expect(o?.titulo).toContain(`${MENSALIDADES_DA_PROVA} vezes a mensalidade`);
    expect(o?.texto).toContain("começam quando os seus dias pagos acabarem");
    expect(o?.acao.href).toBe("/painel/assinatura");
  });

  it("cartão: a troca é feita com a gente, nunca uma segunda cobrança", () => {
    const o = ofertaDoAnual({
      estado: "ATIVO",
      comoPaga: "CARTAO",
      recuperado30dCents: PROVA,
      suporte: SUPORTE,
    });
    expect(o?.acao.href).toBe(SUPORTE);
    expect(o?.texto).toContain("duas vezes");
  });

  it("a economia sai das constantes", () => {
    const o = ofertaDoAnual({
      estado: "PASSE",
      comoPaga: "PIX_30",
      recuperado30dCents: PROVA,
      suporte: SUPORTE,
    });
    expect(o?.texto).toContain(emReais(PRECO_ANUAL_CENTS));
    expect(o?.texto).toContain(emReais(12 * PRECO_MENSAL_CENTS - PRECO_ANUAL_CENTS));
  });

  it("quem já está no anual, em teste ou sem plano não vê", () => {
    const muito = PROVA * 3;
    expect(
      ofertaDoAnual({ estado: "PASSE", comoPaga: "ANUAL", recuperado30dCents: muito, suporte: SUPORTE }),
    ).toBeNull();
    expect(
      ofertaDoAnual({ estado: "TRIAL", comoPaga: null, recuperado30dCents: muito, suporte: SUPORTE }),
    ).toBeNull();
    expect(
      ofertaDoAnual({ estado: "GRATIS", comoPaga: null, recuperado30dCents: muito, suporte: SUPORTE }),
    ).toBeNull();
  });
});

const RAIZ = join(__dirname, "..");
const leia = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

describe("o anual aparece onde a prova aparece", () => {
  it("Minha conta, Dinheiro recuperado e Meus clientes mostram o cartão do anual", () => {
    for (const tela of [
      "app/painel/assinatura/page.tsx",
      "app/painel/livro-caixa/page.tsx",
      "app/painel/clientes/importar/page.tsx",
    ]) {
      expect(leia(tela), tela).toContain("<CartaoDoAnual");
    }
  });

  it("Meus clientes recebe a oferta pronta do servidor", () => {
    expect(leia("app/api/clientes/route.ts")).toContain("anualDaEmpresa(");
  });

  it("o cartão não escreve valor à mão", () => {
    expect(leia("components/cobranca/cartao-do-anual.tsx")).not.toMatch(/R\$\s*\d/);
  });
});
