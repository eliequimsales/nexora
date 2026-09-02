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
    expect(decodeURIComponent(c!.href!.split("?text=")[1])).toBe(c!.texto);
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
    // MUDANÇA DELIBERADA. Antes a função inteira devolvia null aqui, e a ação
    // sumia da tela. Isso passou a ser errado quando o Diagnóstico de Três
    // Nomes chegou: lá o telefone é OPCIONAL, e sumir com o botão
    // transformaria "quase pronto" em "não dá". Agora o texto sai sempre e só
    // o link fica nulo — o dono copia e escolhe o contato na agenda dele.
    for (const telefone of ["123", ""]) {
      const c = conviteDeVolta({ ...base, telefone });
      expect(c.href, telefone).toBeNull();
      expect(c.texto.length, telefone).toBeGreaterThan(20);
    }
  });

  it("aceita telefone já com país e não duplica o 55", () => {
    const c = conviteDeVolta({ ...base, telefone: "5511988881234" })!;
    expect(c.href).toMatch(/wa\.me\/5511988881234\?/);
  });
})

describe("sem telefone, a mensagem tem que sair do mesmo jeito", () => {
  /**
   * ESTE ERA O BLOQUEIO.
   *
   * `conviteDeVolta` devolvia null quando o telefone não dava para virar wa.me —
   * matando a ação inteira. Isso é aceitável quando a lista veio de uma planilha
   * com telefone, mas passa a ser fatal no fluxo de Três Nomes, onde o dono
   * digita o nome de cabeça e o telefone é OPCIONAL.
   *
   * Sem telefone ele ainda consegue agir: copia o texto e escolhe o contato na
   * agenda dele — gesto que ele faz cinquenta vezes por dia. Devolver null
   * transformava "quase pronto" em "não dá".
   */
  const negocio = "Barbearia do Zé";

  it("cliente sem telefone ainda recebe o texto pronto", () => {
    const c = conviteDeVolta({ nome: "Maria Silva", telefone: "", negocio });
    expect(c).not.toBeNull();
    expect(c!.texto).toContain("Maria");
    expect(c!.texto.length).toBeGreaterThan(20);
  });

  it("sem telefone não inventa link", () => {
    const c = conviteDeVolta({ nome: "Maria", telefone: "", negocio });
    expect(c!.href).toBeNull();
  });

  it("telefone ilegível cai no mesmo caminho de 'sem telefone'", () => {
    const c = conviteDeVolta({ nome: "Maria", telefone: "abc123", negocio });
    expect(c).not.toBeNull();
    expect(c!.href).toBeNull();
  });

  it("com telefone válido, o link continua vindo pronto", () => {
    const c = conviteDeVolta({ nome: "Maria", telefone: "11988887777", negocio });
    expect(c!.href).toContain("wa.me/5511988887777");
    expect(c!.href).toContain(encodeURIComponent(c!.texto));
  });

  it("o texto é o mesmo com ou sem telefone — é o mesmo Toque 1", () => {
    const com = conviteDeVolta({ nome: "Maria", telefone: "11988887777", negocio });
    const sem = conviteDeVolta({ nome: "Maria", telefone: "", negocio });
    expect(sem!.texto).toBe(com!.texto);
  });
});
