import { describe, expect, it } from "vitest";
import { iniciaisDe, montarOferta, textosDaOferta } from "@/lib/billing/oferta";
import { emReais, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import type { Diagnostico } from "@/lib/importacao/diagnostico";
import { JANELA_DIAS } from "@/lib/recuperacao/estimativa";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";

/**
 * A OFERTA QUE APARECE ONDE A AÇÃO TRAVA.
 *
 * Quem está sem plano e tenta gerar a onda ou pegar a mensagem pronta recebe,
 * junto da recusa, a conta da própria lista: quantos clientes estão fora do
 * ritmo, a faixa de receita potencial e em quantos retornos a mensalidade se
 * paga. É o mesmo motor do diagnóstico, com as mesmas regras de honestidade:
 * nunca número sem faixa, nunca reais sem valor na lista, e o Corte Honesto
 * recomenda não assinar quando a base é pequena.
 */

function diagnostico(over: Partial<Diagnostico> = {}): Diagnostico {
  return {
    totalClientes: 400,
    sumidos: 118,
    percentualSumido: 30,
    visitasEsperadasNoPeriodo: 3,
    recuperavelCents: { min: 421_200, central: 561_600, max: 702_000 },
    metodo: "método",
    confianca: "alta",
    motivoConfianca: "motivo",
    nomes: [
      {
        nome: "Marcos Silva",
        telefone: "11999990001",
        diasSumido: 74,
        ticketCents: 4_800,
        visitas: 6,
        confianca: "alta",
        porque: "porquê",
      },
      {
        nome: "Renata Alves",
        telefone: "11999990002",
        diasSumido: 51,
        ticketCents: 5_200,
        visitas: 4,
        confianca: "alta",
        porque: "porquê",
      },
    ],
    corteHonesto: false,
    recomendacao: "recomendação",
    faltando: { data: false, valor: false },
    ...over,
  };
}

const SEM_DINHEIRO = { min: 0, central: 0, max: 0 };

describe("montarOferta — a conta é a da lista dele", () => {
  it("leva quem está fora do ritmo e a faixa de receita potencial", () => {
    const o = montarOferta(diagnostico(), 4_800);
    expect(o.sumidos).toBe(118);
    expect(o.faixaMinCents).toBe(421_200);
    expect(o.faixaMaxCents).toBe(702_000);
    expect(o.corteHonesto).toBe(false);
    expect(o.semValor).toBe(false);
    expect(o.semData).toBe(false);
  });

  // R$ 97 ÷ R$ 48 = 2,02. Com dois clientes ainda falta R$ 1: arredondar para
  // baixo prometeria que a mensalidade se paga antes de ela se pagar.
  it("a âncora usa o ticket médio e arredonda para cima", () => {
    expect(montarOferta(diagnostico(), 4_800).clientesQuePagamOPlano).toBe(3);
  });

  it("sem ticket médio, não existe âncora", () => {
    expect(montarOferta(diagnostico(), null).clientesQuePagamOPlano).toBeNull();
    expect(montarOferta(diagnostico(), 0).clientesQuePagamOPlano).toBeNull();
  });

  it("a onda nunca passa do tamanho da onda nem de quem está fora do ritmo", () => {
    expect(montarOferta(diagnostico(), 4_800).clientesNaOnda).toBe(TAMANHO_DA_ONDA);
    expect(montarOferta(diagnostico({ sumidos: 5 }), 4_800).clientesNaOnda).toBe(5);
  });

  it("a prévia mostra iniciais e dias sem vir, nunca nome inteiro ou telefone", () => {
    const o = montarOferta(diagnostico(), 4_800);
    expect(o.previa[0]).toEqual({ iniciais: "M. S.", diasSemVir: 74 });
    const json = JSON.stringify(o);
    expect(json).not.toContain("Marcos");
    expect(json).not.toContain("11999990001");
  });

  it("lista sem valor não vira dinheiro, nem na âncora", () => {
    const o = montarOferta(
      diagnostico({ faltando: { data: false, valor: true }, recuperavelCents: SEM_DINHEIRO }),
      4_800,
    );
    expect(o.semValor).toBe(true);
    expect(o.faixaMinCents).toBe(0);
    expect(o.clientesQuePagamOPlano).toBeNull();
  });
});

describe("iniciaisDe", () => {
  it("usa a primeira e a última palavra do nome", () => {
    expect(iniciaisDe("Marcos da Silva Souza")).toBe("M. S.");
    expect(iniciaisDe("  joão   pedro ")).toBe("J. P.");
    expect(iniciaisDe("Ana")).toBe("A.");
  });

  it("nome vazio não quebra", () => {
    expect(iniciaisDe("")).toBe("");
  });
});

describe("textosDaOferta — o que o cartão diz", () => {
  it("lista com oportunidade: número dele, faixa, âncora e o aviso de que é estimativa", () => {
    const t = textosDaOferta(montarOferta(diagnostico(), 4_800));
    expect(t.recomendaNaoAssinar).toBe(false);
    expect(t.titulo).toContain("118");
    expect(t.prova).toContain(emReais(421_200));
    expect(t.prova).toContain(emReais(702_000));
    expect(t.prova).toContain(`${JANELA_DIAS} dias`);
    expect(t.prova.toLowerCase()).toContain("não é garantia");
    expect(t.ancora).toContain("3 clientes");
    expect(t.ancora).toContain(emReais(PRECO_MENSAL_CENTS));
  });

  it("um cliente só: concordância no singular", () => {
    const t = textosDaOferta(montarOferta(diagnostico({ sumidos: 1 }), 4_800));
    expect(t.titulo).toMatch(/^1 cliente seu está fora do ritmo/);
  });

  it("abaixo do Corte Honesto, recomenda não assinar e não empurra âncora", () => {
    const t = textosDaOferta(
      montarOferta(
        diagnostico({
          sumidos: 14,
          recuperavelCents: { min: 30_000, central: 40_000, max: 50_000 },
          corteHonesto: true,
        }),
        4_800,
      ),
    );
    expect(t.recomendaNaoAssinar).toBe(true);
    expect(t.titulo.toLowerCase()).toContain("não se paga");
    expect(t.ancora).toBeNull();
  });

  it("lista sem valor fala de quem saiu do ritmo, nunca de reais", () => {
    const t = textosDaOferta(
      montarOferta(
        diagnostico({ faltando: { data: false, valor: true }, recuperavelCents: SEM_DINHEIRO }),
        null,
      ),
    );
    expect(`${t.titulo} ${t.prova}`).not.toContain("R$");
    expect(t.ancora).toBeNull();
    expect(t.recomendaNaoAssinar).toBe(false);
  });

  it("lista sem data não afirma quem sumiu", () => {
    const t = textosDaOferta(
      montarOferta(
        diagnostico({
          sumidos: 0,
          nomes: [],
          corteHonesto: false,
          recuperavelCents: SEM_DINHEIRO,
          faltando: { data: true, valor: false },
        }),
        null,
      ),
    );
    expect(t.prova.toLowerCase()).toContain("data");
    expect(t.titulo).not.toMatch(/\d/);
    expect(t.ancora).toBeNull();
    expect(t.recomendaNaoAssinar).toBe(false);
  });
});
