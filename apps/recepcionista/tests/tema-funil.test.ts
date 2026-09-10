import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import config from "@/tailwind.config";

/**
 * O FUNIL PÚBLICO NO VISUAL DA NEXORA ANTIGA.
 *
 * Desenho: docs/superpowers/specs/2026-09-10-visual-antigo-no-funil-design.md
 * (na raiz do monorepo).
 *
 * Duas famílias de cor convivem no mesmo tailwind.config: a do funil (nx-*) e a
 * do painel, jurídico e agendamento (night, mist, paper, panel...). Nada no
 * TypeScript impede uma tela de misturar as duas — o erro só aparece a olho, e
 * só para quem abre aquela tela. Este teste é o olho.
 *
 * Lê os arquivos sem comentários: comentário que cita a classe antiga não é
 * tela usando a classe antiga.
 */

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

/** Prefixos de utilitário do Tailwind que recebem cor. */
const PREFIXO =
  "(?:bg|text|border|ring|from|via|to|fill|stroke|outline|divide|placeholder|decoration|accent|caret|shadow)";

const TOKEN_ANTIGO = new RegExp(
  `(?<![\\w-])(?:[a-z-]+:)*${PREFIXO}-(?:night|mist|paper|panel|amber|leaf)(?!\\w)[\\w/-]*`,
  "g",
);
const FONTE_DE_TITULO = /(?<![\w-])font-display(?![\w-])/g;
/** A paleta papel dos carrosséis, escrita à mão em hex. */
const PAPEL_HEX = /#(?:FAF8F2|EDE7D8|14141C|7A756C|3A372C|6B6553|8A6A00)\b/gi;
/** Sobras de tela clara: fundo branco e texto escuro. */
const LUZ = /(?<![\w:-])(?:bg-white(?![\w/-])|text-(?:gray|slate|zinc|neutral|red)-[5-9]00(?![\w-]))/g;

/**
 * Verificado em lib/importacao/parsers.ts: a exportação de conversa é agrupada
 * por remetente, e uma conversa individual rende UM cliente, sem telefone.
 */
const PROMESSA_EXPORTACAO = /export\w*\s+(?:a\s+)?conversa|conversa\s+(?:exportada|do\s+whatsapp)/i;

function achadosDoTemaAntigo(rel: string): string[] {
  const fonte = leia(rel);
  const achados = [
    ...(fonte.match(TOKEN_ANTIGO) ?? []),
    ...(fonte.match(FONTE_DE_TITULO) ?? []),
    ...(fonte.match(PAPEL_HEX) ?? []),
  ];
  // O botão do Google é branco de propósito: é a variante clara oficial.
  if (rel !== "components/google-button.tsx") achados.push(...(fonte.match(LUZ) ?? []));
  return achados;
}

function aplicaTema(rel: string): void {
  const fonte = leia(rel);
  expect(fonte, rel).toMatch(
    /import\s*\{\s*TemaNexora\s*\}\s*from\s*["']@\/components\/tema-nexora["']/,
  );
  expect(fonte, rel).toMatch(/<TemaNexora>/);
}

const HOME = ["app/page.tsx"];
const ACESSO = [
  "app/cadastro/page.tsx",
  "app/login/page.tsx",
  "app/recuperar/page.tsx",
  "app/redefinir/page.tsx",
  "app/verificar/page.tsx",
  "components/google-button.tsx",
  "app/cadastro/layout.tsx",
  "app/login/layout.tsx",
  "app/recuperar/layout.tsx",
  "app/redefinir/layout.tsx",
  "app/verificar/layout.tsx",
];
const DIAGNOSTICO = [
  "app/diagnostico/page.tsx",
  "app/diagnostico/painel.tsx",
  "components/diagnostico/tres-nomes.tsx",
  "components/acao-convite.tsx",
  "components/funil.tsx",
  "app/diagnostico/layout.tsx",
];
const FUNIL = ["components/tema-nexora.tsx", ...HOME, ...ACESSO, ...DIAGNOSTICO];

describe("a fundação do tema", () => {
  it("a família nx tem os valores da Nexora antiga, e só os que o funil usa", () => {
    const cores = (config.theme?.extend?.colors ?? {}) as unknown as Record<string, unknown>;
    expect(cores.nx).toEqual({
      bg: "#0A0A0F",
      surface: "#111118",
      "surface-2": "#16161F",
      "surface-3": "#1C1C28",
      border: "#1E1E2E",
      "border-2": "#2A2A3A",
      gold: "#EAB308",
      amber: "#F59E0B",
      primary: "#F8F8FF",
      secondary: "#9494A8",
      muted: "#52526B",
      success: { DEFAULT: "#10B981", muted: "#10B98120" },
      error: { DEFAULT: "#EF4444", muted: "#EF444420" },
      warning: { DEFAULT: "#F59E0B", muted: "#F59E0B20" },
    });
    const sombras = (config.theme?.extend?.boxShadow ?? {}) as unknown as Record<string, string>;
    expect(sombras["nx-glow-sm"]).toBe("0 0 20px -4px rgba(245, 158, 11, 0.2)");
    expect(sombras["nx-panel"]).toBe("0 4px 24px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)");
  });

  it("a Geist vem do pacote oficial, declarado no app", () => {
    const pkg = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8"));
    expect(pkg.dependencies?.geist).toMatch(/^\^1\.7\./);
    const tema = leia("components/tema-nexora.tsx");
    expect(tema).toMatch(/from\s+["']geist\/font\/sans["']/);
    expect(tema).toMatch(/from\s+["']geist\/font\/mono["']/);
    expect(tema).toMatch(/export function TemaNexora\b/);
    expect(tema).toContain("tema-nx");
  });

  it("dentro do tema, as três variáveis de fonte apontam para a Geist", () => {
    const css = readFileSync(join(RAIZ, "app/globals.css"), "utf8");
    const bloco = css.match(/\.tema-nx\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(bloco).toMatch(/--font-body:\s*var\(--font-geist-sans\)/);
    expect(bloco).toMatch(/--font-display:\s*var\(--font-geist-sans\)/);
    expect(bloco).toMatch(/--font-mono:\s*var\(--font-geist-mono\)/);
  });

  it("as fontes do painel não são pré-carregadas em toda página", () => {
    const layout = leia("app/layout.tsx");
    expect(layout.match(/preload:\s*false/g) ?? []).toHaveLength(3);
  });
});

describe("a home", () => {
  it("usa só o tema do funil", () => {
    expect(achadosDoTemaAntigo("app/page.tsx")).toEqual([]);
  });

  it("recebe o TemaNexora", () => {
    aplicaTema("app/page.tsx");
  });

  it("não promete subir a base pela exportação de conversa do WhatsApp", () => {
    expect(leia("app/page.tsx")).not.toMatch(PROMESSA_EXPORTACAO);
  });

  it("a lista de exemplo se declara exemplo e usa o tamanho real da Onda", () => {
    const home = leia("app/page.tsx");
    expect(home).toMatch(
      /import\s*\{\s*TAMANHO_DA_ONDA\s*\}\s*from\s*["']@\/lib\/recuperacao\/onda["']/,
    );
    expect(home).toMatch(/Onda de segunda[\s\S]{0,600}exemplo/);
    expect(home).toContain("{TAMANHO_DA_ONDA} clientes");
  });

  it("todo link da home leva a algum lugar que existe", () => {
    // Âncora sem seção e rota sem página são o mesmo defeito: botão que leva a
    // lugar nenhum. A home antiga mandava para /register e /contato, que não
    // existem nesta base — e é dela que o visual está vindo.
    const home = leia("app/page.tsx");
    for (const [, id] of home.matchAll(/href="#([\w-]+)"/g)) {
      expect(home, `#${id}`).toContain(`id="${id}"`);
    }
    for (const [, rota] of home.matchAll(/href="(\/[\w\-/]*)"/g)) {
      const pagina = rota === "/" ? "app/page.tsx" : `app${rota}/page.tsx`;
      expect(existsSync(join(RAIZ, pagina)), rota).toBe(true);
    }
  });
});

describe("cadastro, login e as telas de senha", () => {
  for (const arquivo of ACESSO) {
    it(`${arquivo} usa só o tema do funil`, () => {
      expect(achadosDoTemaAntigo(arquivo)).toEqual([]);
    });
  }

  for (const rota of ["cadastro", "login", "recuperar", "redefinir", "verificar"]) {
    it(`/${rota} recebe o TemaNexora pelo layout`, () => {
      aplicaTema(`app/${rota}/layout.tsx`);
    });
  }
});
