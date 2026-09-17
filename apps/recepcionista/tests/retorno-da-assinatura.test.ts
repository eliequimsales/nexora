import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { inicioDoMes, retornoDaAssinatura } from "@/lib/painel/retorno";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";

/**
 * O QUE VOLTOU CONTRA O QUE CUSTA.
 *
 * O número que decide se o dono renova. Por isso ele é conservador de propósito
 * em três pontos, e cada um tem teste aqui:
 *
 *   1. MESMO PERÍODO NOS DOIS LADOS. O Dinheiro recuperado é acumulado desde
 *      sempre; a mensalidade é de um mês. Dividir um pelo outro faz o
 *      multiplicador crescer sozinho com o tempo — no décimo mês ele diria
 *      "10x" sem nada ter melhorado. A conta é do mês contra a mensalidade do
 *      mês, e o acumulado aparece em reais, sem virar múltiplo.
 *   2. TRUNCA, NUNCA ARREDONDA. 8,49x vira 8,4x, e não 8,5x.
 *   3. SÓ O COMPROVADO. Quem chama a função passa o valor atribuído — o resto
 *      continua fora, como já está em Minha conta e no Livro-Caixa.
 */

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

describe("o retorno sobre a assinatura", () => {
  it("compara o que voltou com o que a Nexora custa no mesmo mês", () => {
    const r = retornoDaAssinatura({ recuperadoCents: 81_480 });
    expect(r.custoCents).toBe(PRECO_MENSAL_CENTS);
    expect(r.multiplicador).toBe(8.4);
    expect(r.texto).toContain("8,4x");
    expect(r.cobre).toBe(true);
  });

  it("trunca a casa decimal, nunca arredonda a favor da venda", () => {
    // 82.400 / 9.700 = 8,4948… — que não pode virar 8,5x.
    expect(retornoDaAssinatura({ recuperadoCents: 82_400 }).multiplicador).toBe(8.4);
  });

  it("recuperado abaixo do custo não finge que cobriu", () => {
    const r = retornoDaAssinatura({ recuperadoCents: PRECO_MENSAL_CENTS - 1 });
    expect(r.cobre).toBe(false);
    expect(r.multiplicador).toBe(0.9);
  });

  it("sem retorno comprovado não existe multiplicador", () => {
    const r = retornoDaAssinatura({ recuperadoCents: 0 });
    expect(r.multiplicador).toBeNull();
    expect(r.cobre).toBe(false);
  });

  it("o estado de R$ 0 termina em ação: as mensagens desta semana", () => {
    const r = retornoDaAssinatura({ recuperadoCents: 0, ticketMedioCents: 5_000 });
    expect(r.educativo).toContain(String(TAMANHO_DA_ONDA));
    expect(r.educativo).toContain("2 clientes");
  });

  // Mesma regra da oferta (lib/billing/oferta.ts): com R$ 48 por visita, dois
  // retornos dão R$ 96 e ainda falta R$ 1. Arredondar para baixo prometeria que
  // a mensalidade se paga antes de ela se pagar.
  it("arredonda para cima quantos clientes cobrem a mensalidade", () => {
    const r = retornoDaAssinatura({ recuperadoCents: 0, ticketMedioCents: 4_800 });
    expect(r.educativo).toContain("3 clientes");
  });

  it("sem saber quanto cada cliente gasta, não inventa o número", () => {
    const r = retornoDaAssinatura({ recuperadoCents: 0, ticketMedioCents: null });
    expect(r.educativo).not.toMatch(/\d+\s+clientes?\s+volt/);
    expect(r.educativo).toContain(String(TAMANHO_DA_ONDA));
  });

  it("com retorno comprovado, o estado educativo sai da frente", () => {
    expect(retornoDaAssinatura({ recuperadoCents: 30_000 }).educativo).toBeNull();
  });
});

describe("o mês do dono é o de Brasília", () => {
  it("a virada do mês em UTC ainda é o mês anterior aqui", () => {
    // 01/09 00:30 em UTC é 31/08 21:30 em São Paulo: quem voltou nessa hora
    // entrou no caixa de agosto, e num servidor em UTC caía em setembro.
    expect(inicioDoMes(new Date("2026-09-01T00:30:00.000Z")).toISOString()).toBe(
      "2026-08-01T03:00:00.000Z",
    );
  });

  it("no meio do mês, começa no dia 1º às 3h UTC", () => {
    expect(inicioDoMes(new Date("2026-09-17T15:00:00.000Z")).toISOString()).toBe(
      "2026-09-01T03:00:00.000Z",
    );
  });
});

describe("onde o retorno aparece", () => {
  it("o custo vem da constante, nunca escrito à mão", () => {
    const fonte = leia("lib/painel/retorno.ts");
    expect(fonte).toContain("PRECO_MENSAL_CENTS");
    expect(fonte).not.toMatch(/9[._]?700|97,00/);
  });

  it("o Dinheiro recuperado mostra o retorno do mês", () => {
    const livro = leia("app/painel/livro-caixa/page.tsx");
    expect(livro).toContain("retornoDaAssinatura(");
    expect(livro).toContain("<CartaoRetorno");
  });

  it("o painel mostra o mesmo cartão, com a mesma conta", () => {
    expect(leia("app/painel/clientes/importar/page.tsx")).toContain("<CartaoRetorno");
  });

  it("o cartão usa a paleta do painel, não a do funil", () => {
    expect(leia("components/painel/cartao-retorno.tsx")).not.toMatch(/-nx-/);
  });

  // O mesmo recorte de mês nas duas telas. Enquanto a conta do fuso ficava
  // copiada dentro da página, "este mês" podia significar duas coisas
  // diferentes em dois lugares do mesmo produto.
  it("as duas telas recortam o mês pela mesma função", () => {
    expect(leia("app/painel/livro-caixa/page.tsx")).toContain("inicioDoMes(");
    expect(leia("app/api/clientes/route.ts")).toContain("inicioDoMes(");
  });
});
