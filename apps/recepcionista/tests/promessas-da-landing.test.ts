import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";
import { TRIAL_DIAS } from "@/lib/billing/acesso";
import { PRECO_MENSAL_CENTS } from "@/lib/billing/preco";

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
const landing = semQuebras(readFileSync(join(RAIZ, "app/page.tsx"), "utf8"));

describe("os números da página são os números do produto", () => {
  it("a Onda anunciada é a Onda que o motor monta", () => {
    expect(TAMANHO_DA_ONDA).toBe(12);
    expect(landing).toContain("doze por semana");
  });

  it("o preço da página é o preço cobrado", () => {
    expect(PRECO_MENSAL_CENTS).toBe(9_700);
    expect(landing).toContain("R$ 97");
  });

  it("o mês grátis anunciado é o trial configurado", () => {
    expect(TRIAL_DIAS).toBe(30);
    expect(landing).toContain("primeiro mês é grátis");
  });
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

describe("as promessas que já foram falsas uma vez não voltam", () => {
  const PROIBIDAS: [string, string][] = [
    ["CNPJ", "não existe CNPJ; o rodapé nunca mostrou um"],
    ["boleto", "só cartão está ligado na Stripe"],
    ["Pix", "a Stripe no Brasil não faz Pix recorrente"],
  ];

  for (const [termo, motivo] of PROIBIDAS) {
    it(`a landing não anuncia "${termo}" — ${motivo}`, () => {
      expect(landing.toLowerCase()).not.toContain(termo.toLowerCase());
    });
  }
});
