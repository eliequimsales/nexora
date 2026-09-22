import { describe, expect, it } from "vitest";
import { telefoneFalado, variantesDeTelefone } from "@/lib/recuperacao/telefone";

/**
 * A base do dono vem de planilha e guarda 11 dígitos ("11988881234").
 * O WhatsApp entrega o JID com país, 13 dígitos ("5511988881234").
 * E o nono dígito faz o MESMO número existir em duas formas.
 * Sem reconciliar isso, buscar cliente por telefone acha zero e não avisa.
 */

const tem = (bruto: string, esperado: string) =>
  expect(variantesDeTelefone(bruto)).toContain(esperado);

describe("celular com país e nono dígito (5511988881234)", () => {
  it("acha a forma salva pela planilha", () => tem("5511988881234", "11988881234"));
  it("acha a forma sem o nono dígito", () => tem("5511988881234", "1188881234"));
  it("mantém a forma original", () => tem("5511988881234", "5511988881234"));
});

describe("celular da planilha (11988881234)", () => {
  it("acha a forma que o WhatsApp mandaria", () => tem("11988881234", "5511988881234"));
  it("acha a forma sem o nono dígito", () => tem("11988881234", "1188881234"));
});

describe("número antigo sem o nono dígito (1188881234)", () => {
  it("acha a forma com nono dígito", () => tem("1188881234", "11988881234"));
  it("acha a forma com país", () => tem("1188881234", "551188881234"));
});

describe("higiene", () => {
  it("aceita formatação humana", () => {
    tem("(11) 98888-1234", "11988881234");
    tem("+55 11 98888 1234", "11988881234");
  });

  it("não inventa variante para lixo", () => {
    expect(variantesDeTelefone("")).toEqual([]);
    expect(variantesDeTelefone("123")).toEqual([]);
    expect(variantesDeTelefone(null as unknown as string)).toEqual([]);
  });

  it("nunca devolve duplicata", () => {
    const v = variantesDeTelefone("5511988881234");
    expect(new Set(v).size).toBe(v.length);
  });

  it("não confunde dois celulares diferentes", () => {
    const a = variantesDeTelefone("11988881234");
    const b = variantesDeTelefone("11977771234");
    expect(a.some((x) => b.includes(x))).toBe(false);
  });
});

describe("telefoneFalado — o número como o dono lê", () => {
  it("celular e fixo, com ou sem o 55", () => {
    expect(telefoneFalado("5511988887777")).toBe("(11) 98888-7777");
    expect(telefoneFalado("11988887777")).toBe("(11) 98888-7777");
    expect(telefoneFalado("551133334444")).toBe("(11) 3333-4444");
  });

  it("o que não é telefone brasileiro volta como veio", () => {
    expect(telefoneFalado("12345")).toBe("12345");
  });
});
