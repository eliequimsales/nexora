import { describe, expect, it } from "vitest";
import { lerParametros } from "@/lib/diagnostico/parametros";
import { SEGMENTOS } from "@/lib/recuperacao/ciclo";

/**
 * PRÉ-PREENCHIMENTO POR URL.
 *
 * O anúncio precisa mandar para /diagnostico?ramo=barbearia&ticket=50&c=bar-a1.
 * Sem isso, três coisas quebram de uma vez: o H1 fala genérico com um público
 * específico, o dono precisa escolher o ramo à mão logo na primeira tela, e
 * não dá para saber qual criativo trouxe quem.
 *
 * TUDO CAI NO PADRÃO EM SILÊNCIO. Valor inválido nunca vira erro na cara de
 * tráfego frio: quem clicou num anúncio não vai depurar uma query string.
 */

describe("ramo", () => {
  it("aceita segmento conhecido", () => {
    const s = SEGMENTOS[0];
    expect(lerParametros({ ramo: s }).ramo).toBe(s);
  });

  it("segmento desconhecido cai no padrão, sem erro", () => {
    expect(lerParametros({ ramo: "nave-espacial" }).ramo).toBeNull();
  });

  it("é derivado das medianas — nunca dessincroniza", () => {
    // Se alguém acrescentar um ramo em MEDIANA_POR_SEGMENTO, ele passa a valer
    // aqui automaticamente. Lista duplicada é lista que envelhece.
    for (const s of SEGMENTOS) expect(lerParametros({ ramo: s }).ramo).toBe(s);
  });

  it("caixa alta e espaço não impedem o reconhecimento", () => {
    expect(lerParametros({ ramo: ` ${SEGMENTOS[0].toUpperCase()} ` }).ramo).toBe(SEGMENTOS[0]);
  });
});

describe("ticket", () => {
  it("aceita número simples", () => {
    expect(lerParametros({ ticket: "50" }).ticketReais).toBe("50");
  });

  it("aceita vírgula decimal", () => {
    expect(lerParametros({ ticket: "49,90" }).ticketReais).toBe("49,90");
  });

  it("fora da faixa cai no padrão", () => {
    // Mesma faixa do zod da rota: R$ 5 a R$ 5.000.
    expect(lerParametros({ ticket: "1" }).ticketReais).toBe("");
    expect(lerParametros({ ticket: "999999" }).ticketReais).toBe("");
  });

  it("texto não numérico cai no padrão", () => {
    expect(lerParametros({ ticket: "muito" }).ticketReais).toBe("");
    expect(lerParametros({ ticket: "<script>" }).ticketReais).toBe("");
  });
});

describe("criativo", () => {
  it("aceita identificador simples", () => {
    expect(lerParametros({ c: "bar-a1" }).criativo).toBe("bar-a1");
  });

  it("recusa o que não é identificador", () => {
    expect(lerParametros({ c: "a b" }).criativo).toBeNull();
    expect(lerParametros({ c: "<script>" }).criativo).toBeNull();
  });
});

describe("nada informado", () => {
  it("devolve os padrões, sem explodir", () => {
    const p = lerParametros({});
    expect(p.ramo).toBeNull();
    expect(p.ticketReais).toBe("");
    expect(p.criativo).toBeNull();
  });

  it("array na query (?ramo=a&ramo=b) não quebra", () => {
    // Next entrega string[] quando o parâmetro se repete.
    expect(lerParametros({ ramo: ["barbearia", "salao"] }).ramo).toBeNull();
  });
});
