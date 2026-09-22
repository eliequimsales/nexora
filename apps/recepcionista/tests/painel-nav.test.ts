import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O MENU DO PAINEL É O FLUXO DE VALOR, NÃO O ÍNDICE DO SISTEMA.
 *
 * Oito abas faziam a tela parecer um ERP: quem entra procura o que fazer HOJE e
 * encontra sete caminhos que não geram dinheiro. Ficam cinco, na ordem do que o
 * dono precisa: a Onda (única tela que gera receita), a prova do que voltou, a
 * base, o WhatsApp e a conta.
 *
 * As telas retiradas continuam existindo e acessíveis por link direto. Tirar do
 * menu é decisão de navegação; apagar a rota seria outra coisa, e este teste
 * existe para que ninguém confunda as duas.
 */

const RAIZ = join(__dirname, "..");
// Sem os comentários: o layout EXPLICA por que "Meu Atendente" virou "WhatsApp",
// e um guarda que lê o texto cru reprovaria a própria explicação.
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const layout = semComentarios(readFileSync(join(RAIZ, "app/painel/layout.tsx"), "utf8"));

const NAV = [...layout.matchAll(/\{\s*href:\s*"([^"]+)",\s*label:\s*"([^"]+)"\s*\}/g)].map(
  ([, href, label]) => ({ href, label }),
);

describe("o menu do painel", () => {
  it("tem exatamente três itens", () => {
    expect(NAV).toHaveLength(3);
  });

  it("segue a ordem do fluxo de valor", () => {
    expect(NAV.map((i) => i.href)).toEqual([
      "/painel/clientes/importar",
      "/painel/onda",
      "/painel/livro-caixa",
    ]);
  });

  it("não leva para telas secundárias fora do fluxo direto de valor", () => {
    for (const fora of ["/painel/conversas", "/painel/treinamento", "/painel/relatorios", "/painel/configuracoes", "/painel/assinatura"]) {
      expect(NAV.map((i) => i.href), fora).not.toContain(fora);
    }
  });
});

describe("tirar do menu não é apagar a tela", () => {
  it("as telas retiradas continuam existindo", () => {
    for (const pagina of [
      "app/painel/conversas/page.tsx",
      "app/painel/treinamento/page.tsx",
      "app/painel/relatorios/page.tsx",
      "app/painel/configuracoes/page.tsx",
      "app/painel/assinatura/page.tsx",
    ]) {
      expect(existsSync(join(RAIZ, pagina)), pagina).toBe(true);
    }
  });
});
