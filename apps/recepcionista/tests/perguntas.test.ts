import { describe, expect, it } from "vitest";
import { GARANTIA_DIAS, ONDAS_MINIMAS } from "@/lib/billing/garantia";
import { PLANOS } from "@/lib/billing/planos";
import { emReais, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { O_QUE_A_NEXORA_NAO_E, PERGUNTAS_FREQUENTES } from "@/lib/perguntas";
import { MIN_RECUPERAVEL_CENTS, MIN_SUMIDOS } from "@/lib/recuperacao/estimativa";

/**
 * AS PERGUNTAS QUE A PÁGINA RESPONDE, E O QUE A NEXORA NÃO É.
 *
 * Moram numa lista só, usada pela landing e pelas páginas de nicho: a resposta de
 * "e se ninguém voltar?" não pode dizer uma coisa na home e outra na página da
 * barbearia. E cada número vem da constante que o código usa.
 */

const resposta = (trecho: string) => {
  const item = PERGUNTAS_FREQUENTES.find((p) => p.pergunta.toLowerCase().includes(trecho));
  if (!item) throw new Error(`Pergunta sobre "${trecho}" não encontrada`);
  return item.resposta;
};

/** Promessas que foram pedidas em algum momento e que o produto não cumpre. */
const PROIBIDAS =
  /disparar mensagens|ia escolhe|banid[oa] em \d|perdem até|garantidos|clique|equipe distribuída|\bRRI\b/i;

describe("as perguntas frequentes", () => {
  it("toda pergunta tem resposta de verdade", () => {
    expect(PERGUNTAS_FREQUENTES.length).toBeGreaterThanOrEqual(5);
    for (const p of PERGUNTAS_FREQUENTES) {
      expect(p.pergunta.endsWith("?"), p.pergunta).toBe(true);
      expect(p.resposta.length, p.pergunta).toBeGreaterThan(40);
    }
  });

  it("sem cartão de crédito dá para pagar no Pix, e a resposta diz que não renova sozinho", () => {
    const r = resposta("cartão");
    expect(r).toContain(emReais(PLANOS.pix_30_dias.valorCents));
    expect(r).toContain("Pix");
    expect(r.toLowerCase()).toContain("sem renovação automática");
  });

  it("'e se ninguém voltar?' responde com a garantia e as condições dela", () => {
    const r = resposta("ninguém voltar");
    expect(r).toContain("Garantia Dinheiro Recuperado");
    expect(r).toContain(`${GARANTIA_DIAS} dias`);
    expect(r).toContain(`${ONDAS_MINIMAS} ondas`);
    expect(r).toContain(emReais(PRECO_MENSAL_CENTS));
    expect(r).toContain(`${MIN_SUMIDOS} clientes sumidos`);
  });

  it("cancelar é pelo painel, sem falar com ninguém", () => {
    expect(resposta("cancel")).toContain("sem falar com ninguém");
  });

  it("lista pequena: a recomendação de não assinar vem com os números do Corte Honesto", () => {
    const r = resposta("pequena");
    expect(r).toContain(`${MIN_SUMIDOS} clientes sumidos`);
    expect(r).toContain(emReais(MIN_RECUPERAVEL_CENTS));
  });

  it("nenhuma resposta usa promessa que o produto não cumpre", () => {
    for (const p of PERGUNTAS_FREQUENTES) {
      expect(`${p.pergunta} ${p.resposta}`, p.pergunta).not.toMatch(PROIBIDAS);
    }
  });
});

describe("o que a Nexora não é", () => {
  it("diz com todas as letras, e sem inventar", () => {
    expect(O_QUE_A_NEXORA_NAO_E.length).toBeGreaterThanOrEqual(4);
    const tudo = O_QUE_A_NEXORA_NAO_E.map((i) => `${i.titulo} ${i.explicacao}`).join(" ");
    expect(tudo.toLowerCase()).toContain("disparo em massa");
    expect(tudo).toContain("CRM");
    expect(tudo.toLowerCase()).toContain("faturamento");
    expect(tudo).not.toMatch(PROIBIDAS);
  });
});
