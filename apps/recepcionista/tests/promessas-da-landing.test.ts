import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GARANTIA_DIAS, ONDAS_MINIMAS } from "@/lib/billing/garantia";
import { FORMAS_DE_PAGAMENTO, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { prometeuTesteGratis } from "@/lib/billing/relogio";
import { VERSAO_DOCUMENTOS } from "@/lib/legal/identidade";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";

/**
 * A LANDING PROMETE; O CÓDIGO CUMPRE. ESTE TESTE AMARRA OS DOIS.
 *
 * O erro que mais se repetiu neste produto não foi bug: foi a tela afirmando
 * o que o código não fazia. Boleto anunciado e desligado. CNPJ no rodapé que
 * nunca existiu. E-mail de confirmação citado numa tela e ausente da régua.
 *
 * Auditar isso à mão funciona uma vez e apodrece na semana seguinte. Aqui cada
 * número da página é conferido contra a constante que o produz — mudar a Onda
 * para 15 por semana quebra o build até alguém corrigir a frase que diz doze.
 *
 * Só entram promessas VERIFICÁVEIS por constante ou por regra de código.
 * Promessa de tom ("é mais devagar de propósito") não é assunto de teste.
 */

const RAIZ = join(__dirname, "..");
// O JSX quebra frase no meio por causa da formatação, então a comparação é
// feita com o espaço em branco normalizado — senão o teste falha por prettier
// e não por promessa quebrada, que é o tipo de guarda que ninguém mantém.
const semQuebras = (s: string) => s.replace(/\s+/g, " ");
const fonte = (rel: string) => semQuebras(readFileSync(join(RAIZ, rel), "utf8"));
const landing = fonte("app/page.tsx");

describe("os números da página são os números do produto", () => {
  it("a Onda anunciada é a Onda que o motor monta", () => {
    expect(TAMANHO_DA_ONDA).toBe(12);
    expect(landing).toContain("doze por semana");
  });

  it("o preço da página é o preço cobrado", () => {
    expect(PRECO_MENSAL_CENTS).toBe(9_700);
    expect(landing).toContain("R$ 97");
  });

  // Desde os Termos de 2026-09-15 a conta nova é grátis para descobrir e paga para
  // recuperar. A garantia ocupa o lugar do mês grátis — anunciar os dois seria
  // prometer a quem chega um teste que o cadastro não dá.
  it("conta nova não ganha mês grátis, e a página não promete um", () => {
    expect(prometeuTesteGratis(VERSAO_DOCUMENTOS)).toBe(false);
    expect(landing.toLowerCase()).not.toContain("mês grátis");
    expect(landing.toLowerCase()).not.toContain("primeiro mês é grátis");
  });

  it("a garantia anunciada sai das constantes da garantia", () => {
    expect(GARANTIA_DIAS).toBe(30);
    expect(ONDAS_MINIMAS).toBe(3);
    expect(landing).toContain("Garantia Dinheiro Recuperado");
    expect(landing).toContain("GARANTIA_DIAS");
  });
});

describe("nenhuma tela de entrada promete o mês grátis que a conta nova não tem", () => {
  const TELAS = [
    "app/layout.tsx",
    "app/cadastro/page.tsx",
    "app/diagnostico/page.tsx",
    "app/diagnostico/painel.tsx",
    "components/diagnostico/custo-vs-retorno.tsx",
  ];

  for (const tela of TELAS) {
    it(`${tela} não promete mês grátis`, () => {
      const texto = fonte(tela).toLowerCase();
      expect(texto).not.toContain("mês grátis");
      expect(texto).not.toContain("primeiro mês é grátis");
      expect(texto).not.toContain("meses são grátis");
    });
  }
});

describe("as regras que a página promete existem no motor", () => {
  const esteiras = readFileSync(join(RAIZ, "lib/recuperacao/esteiras.ts"), "utf8");
  const servico = readFileSync(join(RAIZ, "lib/recuperacao/servico.ts"), "utf8");

  it('"quem tem horário marcado nunca entra na lista" — o motor classifica como EM_DIA', () => {
    expect(landing).toContain("Quem tem horário marcado nunca entra na lista");
    expect(esteiras).toMatch(/if\s*\(\s*temAgendamentoFuturo\s*\)[\s\S]{0,200}EM_DIA/);
  });

  it('"quem já respondeu sai na hora" — respondeu corta o próximo toque', () => {
    expect(landing).toContain("Quem já respondeu sai na hora");
    expect(servico).toContain('["VOLTOU", "MARCOU", "RESPONDEU"]');
    expect(servico).toMatch(/respondeu\s*\?\s*null/);
  });

  it('"não pedimos cartão para começar" — o cadastro não tem campo de cartão', () => {
    expect(landing).toContain("não pedimos cartão para começar");
    const cadastro = readFileSync(join(RAIZ, "app/cadastro/page.tsx"), "utf8");
    // Procura o CAMPO, não a palavra: "sem cartão" aparece legitimamente na
    // própria promessa de que não há cartão. Banir a palavra reprovaria a
    // frase que está certa.
    expect(cadastro).not.toMatch(/type="(tel|text|number)"[^>]*(cart|card|cvv)/i);
    expect(cadastro).not.toMatch(/(cvv|numero do cart|número do cart|card_number)/i);
  });
});

describe("quem presta o serviço sai dos Termos, não de frase solta", () => {
  // "Pessoa física" era verdade até a Nexora virar empresa. O tipo de quem
  // presta o serviço vem do documento nas variáveis do servidor; frase escrita à
  // mão numa página envelhece no dia em que o documento muda.
  it("a landing e o diagnóstico não afirmam o tipo de pessoa do fornecedor", () => {
    for (const tela of ["app/page.tsx", "app/diagnostico/page.tsx"]) {
      expect(fonte(tela).toLowerCase(), tela).not.toContain("pessoa física");
    }
  });
});

describe("as promessas que já foram falsas uma vez não voltam", () => {
  const pixLigado = FORMAS_DE_PAGAMENTO.map((f) => f.toLowerCase()).includes("pix");

  const PROIBIDAS: [string, string][] = [
    ["CNPJ", "o documento de quem presta o serviço vem dos Termos, nunca escrito na página"],
    ["boleto", "o boleto está desligado na Stripe"],
    // Pix só pode aparecer quando estiver ligado — e ligado ele está só nos
    // pagamentos avulsos, nunca na assinatura mensal.
    ...(pixLigado ? [] : ([["Pix", "o Pix não está ligado na Stripe"]] as [string, string][])),
  ];

  for (const [termo, motivo] of PROIBIDAS) {
    it(`a landing não anuncia "${termo}" — ${motivo}`, () => {
      expect(landing.toLowerCase()).not.toContain(termo.toLowerCase());
    });
  }
});
