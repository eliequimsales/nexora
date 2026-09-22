import { describe, expect, it } from "vitest";
import {
  MINUTOS_SEM_RESPOSTA,
  SEMANA_GRATIS_CONVERSAS,
  SEMANA_GRATIS_DIAS,
  TETO_CONVERSAS_MES,
} from "@/lib/atendente/constantes";
import { GARANTIA_DIAS, ONDAS_MINIMAS } from "@/lib/billing/garantia";
import { PLANOS } from "@/lib/billing/planos";
import { emReais, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { O_QUE_A_NEXORA_NAO_E, PERGUNTAS_DA_HOME, PERGUNTAS_FREQUENTES } from "@/lib/perguntas";
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
  // Desde 22/09/2026 são três nãos, os que separam a Nexora da concorrência:
  // disparo, chatbot de menu e configuração. O "não é promessa de faturamento"
  // saiu da lista; a calculadora continua dizendo que é estimativa.
  it("diz com todas as letras, e sem inventar", () => {
    expect(O_QUE_A_NEXORA_NAO_E).toHaveLength(3);
    const tudo = O_QUE_A_NEXORA_NAO_E.map((i) => `${i.titulo} ${i.explicacao}`).join(" ");
    expect(tudo.toLowerCase()).toContain("disparo em massa");
    expect(tudo.toLowerCase()).toContain("chatbot");
    expect(tudo).toContain("CRM");
    expect(tudo).not.toMatch(PROIBIDAS);
  });

  // Desde o Atendente Virtual e a agenda, duas frases antigas viraram mentira.
  it("não contradiz a agenda nem o Atendente", () => {
    const tudo = O_QUE_A_NEXORA_NAO_E.map((i) => `${i.titulo} ${i.explicacao}`).join(" ");
    expect(tudo).not.toMatch(/não substitui o que você já usa para marcar horário/i);
    expect(tudo).not.toMatch(/Nada sai do seu WhatsApp sem você/i);
    expect(tudo).toMatch(/só responde quem escreveu primeiro/);
  });
});

describe("as perguntas sobre o Atendente Virtual", () => {
  it("diz que ele não finge ser gente", () => {
    expect(resposta("finge")).toContain("atendente virtual");
  });

  it("diz quando ele atende com a loja aberta, com o número da constante", () => {
    expect(resposta("aberta")).toContain(`${MINUTOS_SEM_RESPOSTA} minutos`);
  });

  it("diz o que ele faz quando não sabe", () => {
    expect(resposta("não sabe")).toMatch(/anota/);
  });

  it("é honesto sobre o risco do número", () => {
    const r = resposta("risco");
    expect(r).toContain("não é a oficial do WhatsApp");
    expect(r).toContain("não zera");
  });

  it("explica a semana grátis e o que vem depois, com os números das constantes", () => {
    const r = resposta("semana");
    expect(r).toContain(`${SEMANA_GRATIS_DIAS} dias`);
    expect(r).toContain(`${SEMANA_GRATIS_CONVERSAS} conversas`);
    expect(r).toContain(`${TETO_CONVERSAS_MES} conversas`);
    expect(r).toContain(emReais(PRECO_MENSAL_CENTS));
  });

  it("a primeira pergunta não promete mais que nada responde sozinho", () => {
    const r = resposta("sozinha");
    expect(r).toMatch(/Atendente Virtual/);
    expect(r).toMatch(/só responde quem escreveu primeiro/);
  });
});

describe("as quatro perguntas da home", () => {
  it("são as dúvidas que sobram antes de começar", () => {
    expect(PERGUNTAS_DA_HOME.map((p) => p.pergunta)).toEqual([
      "Preciso de cartão de crédito para começar?",
      "Meu WhatsApp corre risco de ser banido?",
      "E se eu não tiver planilha nem computador?",
      "O Atendente Virtual responde besteira para os meus clientes?",
    ]);
  });

  it("o risco do número é dito como é, dos dois lados", () => {
    const r = resposta("banido");
    expect(r).toContain("quem manda é você");
    expect(r).toContain("não é a oficial do WhatsApp");
    expect(r).toContain("não zera");
  });

  // O importador lê texto. Foto de caderno só vira lista pela mão do fundador,
  // e a home não promete o que o produto não faz sozinho.
  it("sem planilha: o mesmo caminho que o diagnóstico ensina, sem prometer foto", () => {
    const r = resposta("planilha");
    expect(r).toContain("um cliente por linha");
    expect(r).not.toMatch(/foto|print/i);
  });

  it("o que ele não sabe, ele não inventa", () => {
    const r = resposta("besteira");
    expect(r).toMatch(/cadastro/);
    expect(r).toMatch(/anota/);
  });
});
