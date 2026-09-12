import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { variaveisPendentesDaStripe } from "@/lib/billing/stripe";
import { lerFornecedor, variaveisPendentesDoFornecedor } from "@/lib/legal/identidade";

/**
 * QUANDO A COBRANÇA NÃO ABRE, A TELA DIZ O QUE FALTA.
 *
 * "A cobrança ainda não está configurada. Fale com a gente." é verdade e é
 * inútil: quem lê é o próprio dono, que É a gente, e fica sem saber qual
 * variável falta no Railway. A mensagem passa a citar os NOMES das variáveis —
 * nunca valores, e só para quem está logado na própria conta.
 */

const RAIZ = join(__dirname, "..");
// Sem os comentários: o código EXPLICA por que "Fale com a gente" saiu, citando a
// frase. O guarda persegue a mensagem que vai para a tela, não a justificativa.
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

const COMPLETO = {
  FORNECEDOR_NOME: "Fulano de Tal",
  FORNECEDOR_DOCUMENTO: "12345678909",
  FORNECEDOR_ENDERECO: "Rua Exemplo, 100, Centro, Cidade/UF, CEP 00000-000",
  FORNECEDOR_EMAIL: "contato@exemplo.com",
};

describe("o que falta na Stripe", () => {
  it("sem nada configurado, aponta as duas variáveis", () => {
    expect(variaveisPendentesDaStripe({})).toEqual(["STRIPE_SECRET_KEY", "STRIPE_PRICE_PRO"]);
  });

  it("aponta só a que falta", () => {
    expect(variaveisPendentesDaStripe({ STRIPE_SECRET_KEY: "sk_test_123" })).toEqual([
      "STRIPE_PRICE_PRO",
    ]);
    expect(variaveisPendentesDaStripe({ STRIPE_PRICE_PRO: "price_123" })).toEqual([
      "STRIPE_SECRET_KEY",
    ]);
  });

  it("com as duas, não falta nada", () => {
    expect(
      variaveisPendentesDaStripe({ STRIPE_SECRET_KEY: "sk_test_123", STRIPE_PRICE_PRO: "price_123" }),
    ).toEqual([]);
  });

  it("valor em branco conta como faltando", () => {
    expect(variaveisPendentesDaStripe({ STRIPE_SECRET_KEY: "   ", STRIPE_PRICE_PRO: "price_123" })).toEqual([
      "STRIPE_SECRET_KEY",
    ]);
  });
});

describe("o que falta na identificação do fornecedor", () => {
  it("traduz campo pendente em nome de variável do Railway", () => {
    const f = lerFornecedor({ ...COMPLETO, FORNECEDOR_ENDERECO: "" });
    expect(variaveisPendentesDoFornecedor(f)).toEqual(["FORNECEDOR_ENDERECO"]);
  });

  it("sem nada, lista as quatro que o dono precisa criar", () => {
    expect(variaveisPendentesDoFornecedor(lerFornecedor({})).sort()).toEqual([
      "FORNECEDOR_DOCUMENTO",
      "FORNECEDOR_EMAIL",
      "FORNECEDOR_ENDERECO",
      "FORNECEDOR_NOME",
    ]);
  });

  it("completo não lista nada", () => {
    expect(variaveisPendentesDoFornecedor(lerFornecedor(COMPLETO))).toEqual([]);
  });
});

describe("a rota do checkout responde o que falta", () => {
  const rota = leia("app/api/billing/checkout/route.ts");

  it("usa as duas listas em vez da frase genérica", () => {
    expect(rota).toContain("variaveisPendentesDaStripe");
    expect(rota).toContain("variaveisPendentesDoFornecedor");
    expect(rota).not.toContain("Fale com a gente");
  });

  it("continua exigindo e-mail verificado e identificação completa", () => {
    // As duas travas que já existiam não podem sumir junto com a mensagem.
    expect(rota).toContain("podeCobrar");
    expect(rota).toContain("identificacaoCompleta()");
  });
});

describe("a tela da conta mostra a mensagem da API", () => {
  it("o botão não fica mais desabilitado por configuração: sem chamada, não há mensagem", () => {
    expect(leia("app/painel/assinatura/page.tsx")).not.toContain("habilitado=");
    expect(leia("app/painel/assinatura/botoes.tsx")).not.toContain("habilitado");
  });

  it("o botão exibe o texto de erro que a API devolveu", () => {
    const botoes = leia("app/painel/assinatura/botoes.tsx");
    expect(botoes).toContain("json.error");
    expect(botoes).toMatch(/\{erro\s*&&/);
  });

  it("a página lista as variáveis que faltam, e nunca valores", () => {
    const pagina = leia("app/painel/assinatura/page.tsx");
    expect(pagina).toContain("variaveisPendentesDaStripe");
    expect(pagina).toContain("variaveisPendentesDoFornecedor");
    expect(pagina).not.toMatch(/process\.env\.STRIPE_SECRET_KEY/);
  });
});
