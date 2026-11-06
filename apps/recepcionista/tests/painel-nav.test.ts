import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O MENU DO PAINEL É O FLUXO DE VALOR, NÃO O ÍNDICE DO SISTEMA.
 *
 * Menu enxuto e unificado com quatro itens essenciais:
 * 1. Atendente Virtual (Configuração + Ensinar em um só lugar)
 * 2. Meus clientes
 * 3. Agenda
 * 4. Planos
 */

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const layout = semComentarios(readFileSync(join(RAIZ, "app/painel/layout.tsx"), "utf8"));

const NAV = [...layout.matchAll(/\{\s*href:\s*"([^"]+)",\s*label:\s*"([^"]+)"\s*\}/g)].map(
  ([, href, label]) => ({ href, label }),
);

describe("o menu do painel", () => {
  it("tem exatamente quatro itens", () => {
    expect(NAV).toHaveLength(4);
  });

  it("segue a ordem do fluxo de valor", () => {
    expect(NAV.map((i) => i.href)).toEqual([
      "/painel/atendente",
      "/painel/clientes/importar",
      "/painel/agenda",
      "/painel/assinatura",
    ]);
  });

  it("o Atendente se chama pelo que é", () => {
    expect(NAV.find((i) => i.href === "/painel/atendente")?.label).toBe("Atendente Virtual");
  });

  it("a aba de agenda se chama Agenda", () => {
    expect(NAV.find((i) => i.href === "/painel/agenda")?.label).toBe("Agenda");
  });

  it("a aba de planos se chama Planos", () => {
    expect(NAV.find((i) => i.href === "/painel/assinatura")?.label).toBe("Planos");
  });

  it("não leva para telas secundárias fora do fluxo direto de valor", () => {
    for (const fora of [
      "/painel/onda",
      "/painel/conversas",
      "/painel/relatorios",
      "/painel/configuracoes",
      "/painel/livro-caixa",
      "/painel/treinamento",
    ]) {
      expect(NAV.map((i) => i.href), fora).not.toContain(fora);
    }
  });
});

describe("tirar do menu não é apagar a tela", () => {
  it("as telas retiradas continuam existindo", () => {
    for (const pagina of [
      "app/painel/onda/page.tsx",
      "app/painel/conversas/page.tsx",
      "app/painel/treinamento/page.tsx",
      "app/painel/relatorios/page.tsx",
      "app/painel/configuracoes/page.tsx",
      "app/painel/assinatura/page.tsx",
      "app/painel/livro-caixa/page.tsx",
    ]) {
      expect(existsSync(join(RAIZ, pagina)), pagina).toBe(true);
    }
  });
});
