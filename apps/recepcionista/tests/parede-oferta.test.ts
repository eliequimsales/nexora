import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A RECUSA VIRA OFERTA.
 *
 * Sem plano, gerar a onda e pegar a mensagem pronta travam (402). Antes a recusa
 * dizia só o motivo e o botão. Agora ela leva a conta da lista do dono — o mesmo
 * motor do diagnóstico —, porque "bloqueado" sem o número dele não é decisão,
 * é parede.
 *
 * Duas regras de engenharia: a oferta nunca derruba a recusa (se o cálculo
 * falhar, a recusa sai sem ela), e o cartão não escreve número nenhum à mão.
 */

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

describe("o servidor devolve a oferta junto da recusa", () => {
  const guarda = leia("lib/billing/guarda.ts");

  it("a recusa leva a oferta calculada com a lista do dono", () => {
    expect(guarda).toContain("ofertaDaEmpresa(");
    expect(guarda).toMatch(/NextResponse\.json\(\s*\{[^}]*oferta/);
  });

  it("falha ao calcular a oferta não derruba a recusa", () => {
    expect(guarda).toMatch(/ofertaDaEmpresa\([^)]*\)\.catch\(/);
  });

  it("a oferta sai do mesmo motor do diagnóstico", () => {
    const conta = leia("lib/billing/oferta-da-conta.ts");
    expect(conta).toContain("gerarDiagnostico(");
    expect(conta).toContain("montarOferta(");
  });

  it("a trava de Meus clientes leva a mesma oferta", () => {
    const rota = leia("app/api/clientes/route.ts");
    expect(rota).toMatch(/trava:[\s\S]{0,240}oferta/);
    expect(rota).toMatch(/ofertaDaEmpresa\([^)]*\)\.catch\(/);
  });
});

describe("as telas mostram a oferta onde a ação trava", () => {
  it("Reativar clientes mostra o cartão da oferta na recusa", () => {
    expect(leia("app/painel/onda/page.tsx")).toContain("<CartaoDaOferta");
  });

  it("Meus clientes mostra o cartão da oferta na trava", () => {
    expect(leia("app/painel/clientes/importar/page.tsx")).toContain("<CartaoDaOferta");
  });

  it("o cartão tira todo texto de textosDaOferta, sem valor escrito à mão", () => {
    const cartao = leia("components/cobranca/cartao-da-oferta.tsx");
    expect(cartao).toContain("textosDaOferta(");
    expect(cartao).not.toMatch(/R\$\s*\d/);
  });
});
