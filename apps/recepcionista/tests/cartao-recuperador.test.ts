import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

describe("CartaoDoRecuperador em Meus clientes", () => {
  it("o componente existe e tem foco em conversão para o Plano Completo", () => {
    const cartao = leia("components/painel/cartao-recuperador.tsx");
    expect(cartao).toContain("Recuperador Automático de Clientes");
    expect(cartao).toContain("Plano Completo");
    expect(cartao).toContain("/painel/assinatura");
    expect(cartao).toContain("/painel/onda");
  });

  it("a tela Meus clientes renderiza o CartaoDoRecuperador no topo", () => {
    const importar = leia("app/painel/clientes/importar/page.tsx");
    expect(importar).toContain("<CartaoDoRecuperador");
    expect(importar).not.toContain("<CartaoDaNoite");
  });

  it("não usa jargões proibidos", () => {
    const cartao = leia("components/painel/cartao-recuperador.tsx");
    expect(cartao).not.toMatch(/\bbases?\b/i);
    expect(cartao).not.toMatch(/\bciclos?\b/i);
    expect(cartao).not.toMatch(/ticket\s*médio/i);
    expect(cartao).not.toMatch(/\btoques?\b/i);
  });
});
