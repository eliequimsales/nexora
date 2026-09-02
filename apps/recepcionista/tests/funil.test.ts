import { describe, expect, it } from "vitest";
import { EVENTOS, ehEventoValido, limparCriativo, type EventoFunil } from "@/lib/funil";

/**
 * INSTRUMENTAÇÃO DO FUNIL.
 *
 * Achado da auditoria de funil: em todo o app não existe UM evento. Zero gtag,
 * zero fbq, zero tabela. Isso significa que "4% completam o diagnóstico" é
 * chute, e que a análise que aponta 6,6x de alavanca está calcada num número
 * que ninguém observou.
 *
 * Gastar R$ 5.000 em anúncio sem isto compra aprendizado nenhum: você saberia
 * quanto gastou e quantos assinaram, e NADA sobre onde as pessoas desistem —
 * que é a única informação capaz de dizer o que consertar.
 *
 * Cinco eventos, nem um a mais. Nunca conteúdo, só o fato de ter acontecido.
 */

describe("a lista de eventos é fechada e pequena", () => {
  it("são exatamente cinco", () => {
    // Cinco cobre o funil inteiro. Vinte viram ninguém olhando nenhum.
    expect(EVENTOS).toHaveLength(5);
  });

  it("cobrem da chegada até a conta", () => {
    expect(EVENTOS).toContain("chegou");
    expect(EVENTOS).toContain("comecou_entrada");
    expect(EVENTOS).toContain("viu_numero");
    expect(EVENTOS).toContain("clicou_mensagem");
    expect(EVENTOS).toContain("criou_conta");
  });

  it("nome fora da lista é recusado", () => {
    expect(ehEventoValido("chegou")).toBe(true);
    expect(ehEventoValido("qualquer_coisa")).toBe(false);
    expect(ehEventoValido("")).toBe(false);
  });
});

describe("o identificador do criativo não vira campo livre", () => {
  /**
   * O `?c=` da URL vem de fora e vira chave de agrupamento no banco. Sem
   * limpeza, ele é entrada de usuário não validada num campo indexado — e um
   * atacante escolhe a cardinalidade da tabela.
   */
  it("aceita identificador simples", () => {
    expect(limparCriativo("bar-a1")).toBe("bar-a1");
    expect(limparCriativo("TESTE_2")).toBe("teste_2");
  });

  it("corta o que não é identificador", () => {
    expect(limparCriativo("<script>")).toBeNull();
    expect(limparCriativo("a b c")).toBeNull();
    expect(limparCriativo("../../etc")).toBeNull();
  });

  it("limita o tamanho", () => {
    expect(limparCriativo("a".repeat(200))).toBeNull();
  });

  it("vazio ou ausente vira nulo, não string vazia", () => {
    expect(limparCriativo("")).toBeNull();
    expect(limparCriativo(undefined)).toBeNull();
    expect(limparCriativo(null)).toBeNull();
  });
});

describe("o evento não carrega conteúdo", () => {
  it("o tipo só permite os campos previstos", () => {
    // Guarda de compilação: se alguém acrescentar `texto` ou `lista` ao evento,
    // isto para de compilar. A página promete que a lista não é gravada.
    const e: EventoFunil = { nome: "viu_numero", criativo: "bar-a1", sessao: "abc123" };
    expect(Object.keys(e).sort()).toEqual(["criativo", "nome", "sessao"]);
  });
});
