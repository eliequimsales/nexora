import { describe, expect, it } from "vitest";
import { conviteDeVolta, primeiroNome } from "@/lib/recuperacao/convite";

/**
 * O DIAGNÓSTICO PRECISA TERMINAR EM AÇÃO.
 *
 * O dono está olhando "Maria, sumida há 214 dias" com o telefone da Maria na
 * mão. A ação que ele quer é mandar mensagem pra Maria AGORA — não criar conta.
 * Este módulo entrega a mensagem pronta e o link, usando o MESMO gerador do
 * Toque 1 da Onda, para as duas telas nunca divergirem.
 */

describe("primeiro nome", () => {
  it("pega só o primeiro e arruma a caixa", () => {
    expect(primeiroNome("MARIA SILVA SANTOS")).toBe("Maria");
    expect(primeiroNome("maria")).toBe("Maria");
    expect(primeiroNome("  joão  pedro ")).toBe("João");
  });

  it("devolve vazio quando não há nome utilizável", () => {
    expect(primeiroNome("")).toBe("");
    expect(primeiroNome("   ")).toBe("");
    expect(primeiroNome("11988881234")).toBe("");
  });
});

describe("convite de volta", () => {
  const base = { nome: "Maria Silva", telefone: "11988881234", negocio: "Barbearia do Zé" };

  it("monta link wa.me com país, e a mensagem vai codificada", () => {
    const c = conviteDeVolta(base);
    expect(c).not.toBeNull();
    expect(c!.href).toMatch(/^https:\/\/wa\.me\/5511988881234\?text=/);
    expect(decodeURIComponent(c!.href.split("?text=")[1])).toBe(c!.texto);
  });

  it("usa o primeiro nome e o nome do negócio", () => {
    const c = conviteDeVolta(base)!;
    expect(c.texto).toContain("Maria");
    expect(c.texto).not.toContain("Silva");
    expect(c.texto).toContain("Barbearia do Zé");
  });

  it("é a MESMA mensagem do Toque 1 — as telas não podem divergir", async () => {
    const { mensagemDoToque } = await import("@/lib/recuperacao/toques");
    const esperado = mensagemDoToque(1, {
      primeiroNome: "Maria",
      negocio: "Barbearia do Zé",
      link: "",
    });
    expect(conviteDeVolta(base)!.texto).toBe(esperado);
  });

  it("sem nome do negócio, não escreve 'da undefined'", () => {
    const c = conviteDeVolta({ ...base, negocio: "" })!;
    expect(c.texto).not.toMatch(/undefined|da \./);
    expect(c.texto).toContain("Maria");
  });

  it("sem nome do cliente, cumprimenta sem vírgula solta", () => {
    const c = conviteDeVolta({ ...base, nome: "" })!;
    expect(c.texto).not.toContain("Oi, !");
    expect(c.texto).not.toContain(" , ");
  });

  it("telefone inválido não vira link quebrado", () => {
    expect(conviteDeVolta({ ...base, telefone: "123" })).toBeNull();
    expect(conviteDeVolta({ ...base, telefone: "" })).toBeNull();
  });

  it("aceita telefone já com país e não duplica o 55", () => {
    const c = conviteDeVolta({ ...base, telefone: "5511988881234" })!;
    expect(c.href).toMatch(/wa\.me\/5511988881234\?/);
  });
})
