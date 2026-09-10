# Visual da Nexora antiga no funil público — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** As 7 telas do funil público (home, diagnóstico, cadastro, login, recuperar, redefinir, verificar) passam a usar o visual da Nexora antiga, sem tocar painel, jurídico e agendamento.

**Architecture:** Uma família de tokens nova (`nx-*`) no `tailwind.config.ts` e um componente de servidor `TemaNexora` que liga a Geist redefinindo as variáveis de fonte. O tema entra por um `layout.tsx` ao lado de cada rota (a home embrulha o próprio conteúdo). As classes antigas são trocadas por um script de migração com tabela fixa, e a fronteira entre os dois temas é vigiada por `tests/tema-funil.test.ts`.

**Tech Stack:** Next.js 14.2 App Router, Tailwind 3.4, pacote `geist` (next/font/local), vitest 1.6, pnpm 10.33 workspace.

**Spec:** `docs/superpowers/specs/2026-09-10-visual-antigo-no-funil-design.md`

## Global Constraints

- Todo caminho abaixo é relativo a `apps/recepcionista`, salvo quando começa com a raiz do monorepo. Comandos rodam com esse diretório como cwd, em PowerShell.
- `apps/app` é só referência. Não muda.
- Nenhum `page.tsx` muda de caminho.
- Não mudam: `app/painel/**`, `app/agendar/**`, `app/termos/**`, `app/privacidade/**`, `app/operador/**`, `app/descadastro/**`, `app/legal.tsx`, `app/error.tsx`, `app/not-found.tsx`.
- Dependência nova: `geist@^1.7.0`. O CSP em `next.config.mjs` não muda.
- Valores da família `nx` exatamente os da tabela do §2.1 do spec.
- Frases travadas em `app/page.tsx` (não podem sumir): "doze por semana", "R$ 97", "primeiro mês é grátis", "Quem tem horário marcado nunca entra na lista", "Quem já respondeu sai na hora", "não pedimos cartão para começar".
- `app/page.tsx` não pode conter "cnpj", "boleto" nem "pix" em lugar nenhum, nem em comentário ou nome de identificador (o teste compara o arquivo cru em minúsculas).
- Ícones são os caracteres `→` e `✓`; `lucide-react` não entra.
- Nunca ler nem imprimir `.env`.
- TDD: nenhum código de produção sem um teste falhando antes.
- Commits em português sem acento, terminando com:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` e
  `Claude-Session: https://claude.ai/code/session_01B6Utz2JQKzx3pc9XppjF9B`

---

### Task 1: A fundação do tema

**Files:**
- Create: `tests/tema-funil.test.ts`
- Modify: `package.json` (via pnpm) e `pnpm-lock.yaml` na raiz do monorepo
- Modify: `tailwind.config.ts` (bloco `colors` e `extend`)
- Create: `components/tema-nexora.tsx`
- Modify: `app/globals.css` (fim do arquivo)
- Modify: `app/layout.tsx:5-21`

**Interfaces:**
- Produces: `TemaNexora({ children }: { children: React.ReactNode })` exportado de `@/components/tema-nexora`; classes Tailwind `*-nx-*`, `shadow-nx-glow-sm`, `shadow-nx-panel`; classe CSS `tema-nx`.
- Produces (no arquivo de teste, usados pelas Tasks 2 a 5): `RAIZ`, `leia(rel: string): string`, `PREFIXO: string`, `PROMESSA_EXPORTACAO: RegExp`, `achadosDoTemaAntigo(rel: string): string[]`, `aplicaTema(rel: string): void`, listas `HOME`, `ACESSO`, `DIAGNOSTICO`, `FUNIL` (`string[]`).

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/tema-funil.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run tests/tema-funil.test.ts`
Expected: FAIL nos 4 testes — `cores.nx` é `undefined`, `pkg.dependencies.geist` é `undefined`, ENOENT em `components/tema-nexora.tsx`, bloco `.tema-nx` vazio, `preload: false` com 0 ocorrências.

- [ ] **Step 3: Instalar a Geist**

Run (a partir da raiz do monorepo, o pacote já está no store):
`pnpm -C "C:\Users\eli\Downloads\Documents\saas-platform" --filter recepcionista add geist@^1.7.0 --prefer-offline`
Expected: `package.json` de `apps/recepcionista` ganha `"geist": "^1.7.0"` em `dependencies`, e o `pnpm-lock.yaml` da raiz é atualizado.

- [ ] **Step 4: Adicionar a família `nx` e as sombras**

Em `tailwind.config.ts`, trocar:

```ts
        wa: {
          frame: "#0B141A",
          in: "#202C33",
          out: "#005C4B",
        },
```

por:

```ts
        wa: {
          frame: "#0B141A",
          in: "#202C33",
          out: "#005C4B",
        },
        // Funil público — o visual da Nexora antiga (apps/app), valores copiados
        // de lá. Só entra o que as telas antigas usavam. A fronteira é vigiada
        // por tests/tema-funil.test.ts: nx-* só no funil, o resto só fora dele.
        nx: {
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
        },
```

E trocar:

```ts
      maxWidth: {
        page: "72rem",
      },
```

por:

```ts
      maxWidth: {
        page: "72rem",
      },
      boxShadow: {
        "nx-glow-sm": "0 0 20px -4px rgba(245, 158, 11, 0.2)",
        "nx-panel": "0 4px 24px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)",
      },
```

- [ ] **Step 5: Criar o `TemaNexora`**

Criar `components/tema-nexora.tsx`:

```tsx
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

/**
 * O VISUAL DA NEXORA ANTIGA, SÓ NO FUNIL PÚBLICO.
 *
 * Os anúncios rodaram em cima da Nexora antiga (apps/app): quem clica espera
 * aquela cara. Home, diagnóstico, cadastro, login e as telas de senha usam este
 * tema; painel, jurídico e agendamento continuam no de antes.
 *
 * A troca de fonte não passa por classe nenhuma: .tema-nx (app/globals.css)
 * redefine --font-body, --font-display e --font-mono, então tudo aqui dentro
 * vira Geist — inclusive componentes que já existiam.
 *
 * Componente de servidor de propósito. As telas "use client" o recebem por um
 * layout.tsx ao lado, e ele não vai parar no código enviado ao navegador.
 */
export function TemaNexora({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${GeistSans.variable} ${GeistMono.variable} tema-nx min-h-screen bg-nx-bg text-nx-primary antialiased`}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Redefinir as fontes dentro do tema**

No fim de `app/globals.css`, acrescentar:

```css

/* ——— Funil público no visual da Nexora antiga (components/tema-nexora.tsx) ———
   As classes font-sans, font-mono e font-display do Tailwind leem estas
   variáveis. Redefinidas aqui, tudo dentro do funil vira Geist sem trocar
   classe nenhuma. Seleção e foco saem do verde e vão para o âmbar da antiga. */
.tema-nx {
  --font-body: var(--font-geist-sans), system-ui, sans-serif;
  --font-display: var(--font-geist-sans), system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
  font-family: var(--font-body);
}

.tema-nx ::selection {
  background-color: rgba(245, 158, 11, 0.2);
}

.tema-nx :focus-visible {
  outline-color: rgba(245, 158, 11, 0.6);
}
```

- [ ] **Step 7: Tirar o pré-carregamento das fontes atuais**

Em `app/layout.tsx`, trocar:

```ts
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
});

const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});
```

por:

```ts
// preload: false nas três. Elas servem painel, jurídico e agendamento; o funil
// público usa a Geist (components/tema-nexora.tsx). Pré-carregadas, desciam em
// toda página — inclusive no 4G de quem chega pelo anúncio e nunca as vê.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
  preload: false,
});

const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
  preload: false,
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  preload: false,
});
```

- [ ] **Step 8: Rodar e ver passar**

Run: `pnpm exec vitest run tests/tema-funil.test.ts`
Expected: PASS, 4 testes.

- [ ] **Step 9: Commit**

```powershell
git add -- tests/tema-funil.test.ts package.json tailwind.config.ts components/tema-nexora.tsx app/globals.css app/layout.tsx ../../pnpm-lock.yaml
git commit -m @'
funil: fundacao do visual da Nexora antiga

Familia de tokens nx-* com os valores da antiga, Geist pelo pacote oficial
num TemaNexora de servidor, e as fontes do painel sem pre-carregamento.
A trava tests/tema-funil.test.ts nasce aqui.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B6Utz2JQKzx3pc9XppjF9B
'@
```

---

### Task 2: A home

**Files:**
- Modify: `app/page.tsx` (reescrita completa)
- Test: `tests/tema-funil.test.ts` (acrescentar `describe("a home")` no fim)

**Interfaces:**
- Consumes: `TemaNexora` de `@/components/tema-nexora`; `TAMANHO_DA_ONDA` (number, 12) de `@/lib/recuperacao/onda`; helpers `leia`, `achadosDoTemaAntigo`, `aplicaTema`, `PROMESSA_EXPORTACAO`, `RAIZ` da Task 1.
- Produces: `app/page.tsx` com `id="como-funciona"` e `id="preco"`; nenhum `id="calculadora"` (o sub-projeto 2 cria).

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar no fim de `tests/tema-funil.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run tests/tema-funil.test.ts -t "a home"`
Expected: FAIL em 4 — tokens antigos listados (`bg-night`, `text-mist/65`, `font-display`...), import do `TemaNexora` ausente, `conversa exportada` encontrada, `TAMANHO_DA_ONDA` ausente. O teste de links PASSA já hoje: é guarda de regressão.

- [ ] **Step 3: Reescrever a home**

Substituir todo o conteúdo de `app/page.tsx` por:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { TemaNexora } from "@/components/tema-nexora";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";

export const metadata: Metadata = {
  title: "Nexora — ganhe dinheiro trazendo seus clientes sumidos de volta",
  description:
    "A Nexora descobre quais clientes pararam de voltar e te entrega a mensagem pronta para trazer cada um. Primeiro mês grátis, sem cartão.",
};

/**
 * A LANDING.
 *
 * O CTA principal não é "criar conta" — é o Diagnóstico. Prova de primeira
 * pessoa sobre a base DELE converte muito mais que promessa sobre o produto, e
 * é a única prova que a gente tem enquanto não existe depoimento.
 *
 * ---
 *
 * DIREÇÃO VISUAL (10/09/2026). Os anúncios da Meta rodaram em cima da Nexora
 * antiga (apps/app), e quem clica espera aquela cara: Geist, hero centralizado,
 * dourado com brilho. A página volta para aquele visual e para a ordem daquela
 * home — a dor, a conta, e onde os clientes aparecem. O conteúdo de baixo é o
 * desta base, porque é o que o código cumpre (tests/promessas-da-landing.test.ts).
 * As seções da antiga que prometiam o que não existe mais ficaram de fora.
 *
 * Desenho: docs/superpowers/specs/2026-09-10-visual-antigo-no-funil-design.md
 */

const SELOS = ["Grátis pra começar", "Sem cartão", "Sem integração", "Funciona com planilha"];

/**
 * Exemplo, e a tela diz que é exemplo. Os ritmos são plausíveis para uma
 * barbearia; os nomes não são de ninguém.
 */
const ONDA_EXEMPLO = [
  { nome: "Marcos", ciclo: 28, dias: 64 },
  { nome: "Dona Cida", ciclo: 35, dias: 90 },
  { nome: "Júnior", ciclo: 21, dias: 45 },
];

const PASSOS = [
  {
    titulo: "Você manda sua lista do jeito que ela está",
    // O WhatsApp não entra aqui: o importador agrupa a exportação por remetente,
    // e uma conversa rende um cliente só, sem telefone.
    corpo:
      "Colado do Excel, arquivo CSV ou caderno digitado. A Nexora entende e diz em português o que não conseguiu ler.",
  },
  {
    titulo: "Ela descobre o ritmo de cada cliente",
    corpo:
      "Nada de regra de 60 dias para todo mundo. Quem ia toda semana e sumiu há um mês está muito mais atrasado que quem ia de três em três meses.",
  },
  {
    titulo: "Toda segunda, doze mensagens prontas",
    corpo:
      "Uma para cada cliente, com o nome dele escrito. Você lê, muda se quiser e manda do SEU WhatsApp. Uns nove minutos.",
  },
];

const INCLUI = [
  "Primeiro mês grátis, sem pedir cartão",
  "Sua lista importada do jeito que ela estiver",
  "Doze mensagens prontas por semana, escritas para cada cliente",
  "Página de agendamento com seu link, para o cliente marcar sozinho",
  "O quanto você já recuperou, em reais, com nome de quem voltou",
  "Cancele quando quiser — você fica com o período que já pagou",
];

/** O botão dourado da Nexora antiga, com o brilho. */
const BOTAO_DOURADO =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-nx-gold font-semibold text-nx-bg shadow-nx-glow-sm transition-all hover:bg-nx-gold/90 active:scale-[0.98]";

export default function Home() {
  return (
    <TemaNexora>
      <header className="sticky top-0 z-40 border-b border-nx-border bg-nx-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-nx-gold text-base font-bold text-nx-bg">
              N
            </span>
            <span className="font-semibold">Nexora</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-nx-secondary transition-colors hover:text-nx-primary"
            >
              Entrar
            </Link>
            <Link href="/diagnostico" className={`${BOTAO_DOURADO} px-4 py-2 text-sm`}>
              Ver meus clientes <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO — o texto da Nexora antiga. */}
        <section className="px-6 pb-12 pt-16 sm:pt-20">
          <div className="mx-auto max-w-4xl space-y-6 text-center">
            <h1 className="text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl lg:text-[3.75rem]">
              Seus clientes não avisam que estão indo embora.
              <br className="hidden sm:block" />{" "}
              <span className="text-nx-gold">Eles só param de voltar.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-nx-secondary sm:text-xl">
              A Nexora mostra quem parou de comprar, quanto dinheiro isso representa e a
              mensagem exata pra trazer cada um de volta.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
              <Link href="/diagnostico" className={`${BOTAO_DOURADO} px-7 py-4 text-base`}>
                Descobrir meus clientes <span aria-hidden="true">→</span>
              </Link>
              <a
                href="#como-funciona"
                className="rounded-lg border border-nx-border px-6 py-4 text-base font-medium transition-colors hover:bg-nx-surface"
              >
                Ver como funciona
              </a>
            </div>
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-3 text-xs text-nx-muted">
              {SELOS.map((selo) => (
                <li key={selo} className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="text-nx-success">
                    ✓
                  </span>
                  {selo}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* A CONTA — o lugar da calculadora (sub-projeto 2). Até ela chegar, a
            conta vai escrita, e nenhum botão da página promete calcular nada. */}
        <section className="px-6 pb-20 pt-4">
          <div className="mx-auto max-w-4xl rounded-2xl border border-nx-border bg-nx-surface p-8 text-center sm:p-12">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-nx-gold">
              A conta que ninguém faz
            </p>
            <p className="mx-auto mt-4 max-w-3xl text-2xl font-semibold leading-[1.4] tracking-tight sm:text-3xl">
              Faz a conta agora: quantos clientes te mandaram mensagem no ano passado e nunca
              mais voltaram? Multiplica pelo seu ticket médio.{" "}
              <span className="text-nx-gold">Esse número já foi seu uma vez.</span>
            </p>
          </div>
        </section>

        {/* ONDE ELES APARECEM — no lugar do painel de exemplo da antiga. */}
        <section className="px-6 pb-20">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-10 text-center text-2xl font-bold sm:text-3xl">
              E é aqui que esses clientes aparecem
            </h2>
            <div className="mx-auto max-w-xl rounded-2xl border border-nx-border bg-nx-surface p-5 shadow-nx-glow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-nx-border pb-3">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">Onda de segunda</p>
                  <span className="rounded-full border border-nx-border bg-nx-surface-2 px-2 py-0.5 text-[11px] font-medium text-nx-muted">
                    exemplo
                  </span>
                </div>
                <span className="font-mono text-[11px] text-nx-muted">
                  {TAMANHO_DA_ONDA} clientes · ~9 min
                </span>
              </div>
              <ul>
                {ONDA_EXEMPLO.map((c) => (
                  <li
                    key={c.nome}
                    className="flex items-center justify-between gap-4 border-b border-nx-border py-3 last:border-b-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-semibold">{c.nome}</p>
                      <p className="text-xs text-nx-secondary">
                        vinha a cada {c.ciclo} dias · sumiu há {c.dias}
                      </p>
                    </div>
                    {/* Etiqueta, não botão: numa lista de exemplo, nada finge ser clicável. */}
                    <span className="shrink-0 rounded-md border border-nx-gold/25 bg-nx-gold/10 px-3 py-1 text-xs font-semibold text-nx-gold">
                      Mandar
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-20 bg-nx-surface-2/30 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold sm:text-4xl">Como funciona</h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {PASSOS.map((p, i) => (
                <div key={p.titulo} className="rounded-xl border border-nx-border bg-nx-surface p-6">
                  <span className="font-mono text-xs font-bold tracking-[0.14em] text-nx-gold">
                    PASSO {i + 1}
                  </span>
                  <h3 className="mt-3 font-semibold leading-snug">{p.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-nx-secondary">{p.corpo}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-bold sm:text-4xl">
              Isso não é disparo em massa
            </h2>
            <div className="mt-8 grid gap-5 text-lg leading-relaxed text-nx-secondary">
              <p>
                Ferramenta de disparo manda a mesma mensagem para a lista inteira. Duas coisas
                acontecem: o WhatsApp bane o número — e o número da sua empresa é a sua agenda
                inteira — e quem esteve na sua loja ontem recebe uma mensagem de saudade e
                percebe que é robô.
              </p>
              <p>
                A Nexora manda <strong className="font-semibold text-nx-primary">doze por semana</strong>,
                escolhidas pelo ritmo de cada um. Quem tem horário marcado nunca entra na
                lista. Quem já respondeu sai na hora. E você lê cada mensagem antes de mandar.
                É mais devagar de propósito.
              </p>
            </div>
          </div>
        </section>

        <section id="preco" className="scroll-mt-20 bg-nx-surface-2/30 px-6 py-20">
          <div className="mx-auto grid max-w-5xl gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold sm:text-4xl">Um preço, sem pegadinha</h2>
              <p className="mt-8 flex items-baseline gap-2">
                <span className="text-7xl font-bold tracking-tight">R$ 97</span>
                <span className="text-nx-secondary">/mês, impostos inclusos</span>
              </p>
              <p className="mt-6 max-w-md leading-relaxed text-nx-secondary">
                O primeiro mês é grátis e não pedimos cartão para começar. Você decide se
                assina depois de ver, na tela, quem voltou e quanto pagou.
              </p>
              <Link href="/diagnostico" className={`${BOTAO_DOURADO} mt-9 px-7 py-4`}>
                Começar pelo diagnóstico grátis <span aria-hidden="true">→</span>
              </Link>
            </div>
            <ul className="rounded-xl border border-nx-border bg-nx-surface px-6">
              {INCLUI.map((item) => (
                <li
                  key={item}
                  className="flex gap-4 border-b border-nx-border py-4 text-[15px] leading-relaxed last:border-b-0"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-nx-gold" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="px-6 pb-24 pt-20">
          <div className="mx-auto max-w-3xl rounded-2xl border border-nx-gold/30 bg-nx-surface p-8 text-center sm:p-12">
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
              Antes de decidir, veja o tamanho do buraco.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-nx-secondary">
              Cola a lista que você já tem e a Nexora te mostra, com nome e sobrenome, quem
              parou de voltar. Não precisa criar conta para ver, e a lista não fica com a
              gente.
            </p>
            <Link href="/diagnostico" className={`${BOTAO_DOURADO} mt-8 px-8 py-4 text-lg`}>
              Ver quem sumiu da minha base <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-nx-border px-6 pb-24 pt-10 sm:pb-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-nx-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-sm">
            Nexora — recuperação de clientes inativos para pequenos negócios de serviço.
            Serviço prestado por pessoa física; a identificação completa está nos Termos de
            Uso.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/termos" className="transition-colors hover:text-nx-primary">
              Termos de Uso
            </Link>
            <Link href="/privacidade" className="transition-colors hover:text-nx-primary">
              Privacidade
            </Link>
            <Link href="/login" className="transition-colors hover:text-nx-primary">
              Entrar
            </Link>
            <Link href="/diagnostico" className="transition-colors hover:text-nx-primary">
              Diagnóstico grátis
            </Link>
          </div>
        </div>
      </footer>

      {/* No celular o botão nunca sai da tela — veio da Nexora antiga. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-nx-border bg-nx-bg/95 p-3 backdrop-blur-md sm:hidden">
        <Link href="/diagnostico" className={`${BOTAO_DOURADO} w-full px-5 py-3.5`}>
          Descobrir meus clientes <span aria-hidden="true">→</span>
        </Link>
      </div>
    </TemaNexora>
  );
}
```

- [ ] **Step 4: Rodar e ver passar — a trava nova e as antigas da home**

Run: `pnpm exec vitest run tests/tema-funil.test.ts tests/promessas-da-landing.test.ts tests/formas-pagamento.test.ts`
Expected: PASS em todos (a fundação, a home, as promessas e as formas de pagamento).

- [ ] **Step 5: Commit**

```powershell
git add -- app/page.tsx tests/tema-funil.test.ts
git commit -m @'
funil: home no visual da Nexora antiga

Hero centralizado e selos da antiga, a conta escrita no lugar da futura
calculadora, a Onda de exemplo declarada como exemplo e o conteudo atual
(preco, nao e disparo) no visual novo. Sai a promessa de conversa exportada
do WhatsApp, que rende um cliente so.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B6Utz2JQKzx3pc9XppjF9B
'@
```

---

### Task 3: Cadastro, login e as telas de senha

**Files:**
- Create: `app/cadastro/layout.tsx`, `app/login/layout.tsx`, `app/recuperar/layout.tsx`, `app/redefinir/layout.tsx`, `app/verificar/layout.tsx`
- Modify (pelo script): `app/cadastro/page.tsx`, `app/login/page.tsx`, `app/recuperar/page.tsx`, `app/redefinir/page.tsx`, `app/verificar/page.tsx`, `components/google-button.tsx`
- Create (fora do repo, uso único): `C:\Users\eli\AppData\Local\Temp\claude\C--Users-eli\88eed0d9-8968-478b-9b41-c05c288da55b\scratchpad\migrar-tema-funil.mjs`
- Test: `tests/tema-funil.test.ts` (acrescentar `describe` no fim)

**Interfaces:**
- Consumes: `TemaNexora`; helpers `achadosDoTemaAntigo`, `aplicaTema`, lista `ACESSO` da Task 1.
- Produces: o script `migrar-tema-funil.mjs`, que a Task 4 roda de novo: `node <script> <arquivo> [<arquivo>...]`, com caminhos relativos a `apps/recepcionista` e barras `/`.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar no fim de `tests/tema-funil.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run tests/tema-funil.test.ts -t "telas de senha"`
Expected: FAIL em 16 — as 6 telas listam tokens antigos (`bg-panel-bg`, `text-mist/50`, `bg-white`, `text-red-600`, `border-panel-line`...), e os 5 layouts e os 5 `aplicaTema` dão ENOENT.

- [ ] **Step 3: Criar os cinco layouts**

Criar `app/cadastro/layout.tsx`, `app/login/layout.tsx`, `app/recuperar/layout.tsx`, `app/redefinir/layout.tsx` e `app/verificar/layout.tsx`, todos com este conteúdo:

```tsx
import { TemaNexora } from "@/components/tema-nexora";

// Funil público: esta tela usa o visual da Nexora antiga (components/tema-nexora.tsx).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <TemaNexora>{children}</TemaNexora>;
}
```

- [ ] **Step 4: Salvar o script de migração**

Criar `C:\Users\eli\AppData\Local\Temp\claude\C--Users-eli\88eed0d9-8968-478b-9b41-c05c288da55b\scratchpad\migrar-tema-funil.mjs`:

```js
// Uso único. Troca as classes do tema atual pelas nx-* nos arquivos do funil,
// seguindo a tabela do §4 do spec. cwd = apps/recepcionista.
//   node migrar-tema-funil.mjs app/login/page.tsx app/cadastro/page.tsx ...
import { readFileSync, writeFileSync } from "node:fs";

// Rodam ANTES das gerais: casos que dependem do contexto do arquivo.
const POR_ARQUIVO = {
  "app/cadastro/page.tsx": [
    [/bg-white px-3 py-2\.5/g, "bg-nx-surface-2 px-3 py-2.5 placeholder:text-nx-muted"],
    [/(?<![\w:-])shadow-sm(?![\w-])/g, "shadow-nx-panel"],
  ],
  "app/login/page.tsx": [
    [/bg-white px-3 py-2\.5/g, "bg-nx-surface-2 px-3 py-2.5 placeholder:text-nx-muted"],
    [/(?<![\w:-])shadow-sm(?![\w-])/g, "shadow-nx-panel"],
  ],
  "app/verificar/page.tsx": [
    [/bg-paper px-6/g, "bg-nx-bg px-6"],
    [/bg-white p-8/g, "bg-nx-surface p-8 shadow-nx-panel"],
  ],
  // O cartão "Não compre a Nexora agora" era papel escrito em hex.
  "app/diagnostico/painel.tsx": [
    [/bg-\[#FAF8F2\]/g, "border border-nx-gold/30 bg-nx-surface"],
    [/text-\[#0A0A0F\]/g, "text-nx-primary"],
    [/text-\[#8A6A00\]/g, "text-nx-gold"],
    [/text-\[#3A372C\]/g, "text-nx-secondary"],
    [/text-\[#6B6553\]/g, "text-nx-muted"],
    [/bg-\[#0A0A0F\]/g, "border border-nx-border bg-nx-surface-2"],
    [/text-\[#FAF8F2\]/g, "text-nx-primary"],
  ],
};

const GERAIS = [
  // Campos (a classe tem outline-none) usam a superfície de campo da antiga.
  [/"[^"\n]*\boutline-none\b[^"\n]*"/g, (s) => s.replace(/(?<![\w:-])bg-night(?![\w/-])/g, "bg-nx-surface-2")],
  // Botões dourados ganham o brilho. O "N" do logo não tem px- logo depois.
  [/(?<![\w:-])bg-amber(?= px-)/g, "bg-nx-gold shadow-nx-glow-sm"],
  [/(?<![\w-])focus:border-amber(?![\w/-])/g, "focus:border-nx-gold/60 focus:ring-2 focus:ring-nx-gold/15"],
  [/(?<![\w-])hover:text-(?:mist|panel-ink)(?:\/\d+)?(?![\w/-])/g, "hover:text-nx-primary"],
  [/(?<![\w-])hover:border-mist\/\d+/g, "hover:border-nx-border-2"],
  [/(?<![\w-])placeholder:text-mist\/\d+/g, "placeholder:text-nx-muted"],
  [/(?<![\w:-])text-mist\/(\d+)/g, (_, o) => (Number(o) <= 45 ? "text-nx-muted" : "text-nx-secondary")],
  [/(?<![\w:-])text-mist(?![\w/-])/g, "text-nx-primary"],
  [/(?<![\w:-])bg-mist\/\d+/g, "bg-nx-surface-2"],
  [/(?<![\w:-])bg-night-soft(\/\d+)?/g, (_, o) => `bg-nx-surface${o ?? ""}`],
  [/(?<![\w:-])bg-night(\/\d+)?(?![\w-])/g, (_, o) => `bg-nx-bg${o ?? ""}`],
  [/(?<![\w:-])bg-panel-bg(?![\w-])/g, "bg-nx-bg"],
  [/(?<![\w:-])bg-panel-card(?![\w-])/g, "bg-nx-surface"],
  [/(?<![\w:-])bg-panel-line(?![\w-])/g, "bg-nx-border"],
  [/(?<![\w:-])bg-paper(?![\w-])/g, "bg-nx-surface"],
  [/(?<![\w:-])border-(?:night|paper|panel)-line(?![\w-])/g, "border-nx-border"],
  [/(?<![\w:-])text-(?:paper|panel)-ink(?![\w-])/g, "text-nx-primary"],
  [/(?<![\w:-])text-(?:paper|panel)-sub(?![\w-])/g, "text-nx-secondary"],
  [/(?<![\w:-])text-night(?![\w/-])/g, "text-nx-bg"],
  [
    /(?<![\w-])((?:[a-z]+:)*)(bg|text|border|ring)-amber(?:-deep)?(\/\d+)?(?![\w-])/g,
    (_, p, u, o) => `${p}${u}-nx-gold${o ?? ""}`,
  ],
  [
    /(?<![\w-])((?:[a-z]+:)*)(bg|text|border)-leaf(?:-dark)?(\/\d+)?(?![\w-])/g,
    (_, p, u, o) => `${p}${u}-nx-success${o ?? ""}`,
  ],
  [/(?<![\w:-])text-red-(?:300|600)(?![\w-])/g, "text-nx-error"],
  // A Geist não tem face de título: font-display sai, com o espaço que sobrar.
  [/ ?(?<![\w-])font-display(?![\w-]) ?/g, (m) => (m.startsWith(" ") && m.endsWith(" ") ? " " : "")],
  // Hover do botão dourado igual ao da antiga.
  [
    /"[^"\n]*\bbg-nx-gold shadow-nx-glow-sm\b[^"\n]*"/g,
    (s) => s.replace(/hover:brightness-1\d\d/g, "hover:bg-nx-gold/90 active:scale-[0.98]"),
  ],
];

for (const arquivo of process.argv.slice(2)) {
  const antes = readFileSync(arquivo, "utf8");
  let depois = antes;
  for (const [de, para] of [...(POR_ARQUIVO[arquivo] ?? []), ...GERAIS]) {
    depois = depois.replace(de, para);
  }
  writeFileSync(arquivo, depois);
  console.log(`${arquivo}: ${antes === depois ? "sem mudança" : "migrado"}`);
}
```

- [ ] **Step 5: Rodar o script nas seis telas**

Run: `node "C:\Users\eli\AppData\Local\Temp\claude\C--Users-eli\88eed0d9-8968-478b-9b41-c05c288da55b\scratchpad\migrar-tema-funil.mjs" app/cadastro/page.tsx app/login/page.tsx app/recuperar/page.tsx app/redefinir/page.tsx app/verificar/page.tsx components/google-button.tsx`
Expected: as seis linhas dizem `migrado`.

- [ ] **Step 6: Rodar e ver passar**

Run: `pnpm exec vitest run tests/tema-funil.test.ts tests/promessas-da-landing.test.ts`
Expected: PASS. Se algum arquivo ainda listar classe antiga (uma variante com prefixo que o script não previu), trocar à mão seguindo a mesma tabela e rodar de novo. `promessas-da-landing` confere que o cadastro continua sem campo de cartão.

- [ ] **Step 7: Revisar o diff**

Run: `git diff -- app/cadastro/page.tsx app/login/page.tsx app/recuperar/page.tsx app/redefinir/page.tsx app/verificar/page.tsx components/google-button.tsx`
Expected: só mudam `className`. Nenhum texto, `href`, `onClick`, `fetch` ou estado muda. O botão do Google continua `bg-white` e `text-gray-800`, só com `border-nx-border`.

- [ ] **Step 8: Commit**

```powershell
git add -- app/cadastro app/login app/recuperar app/redefinir app/verificar components/google-button.tsx tests/tema-funil.test.ts
git commit -m @'
funil: cadastro, login e telas de senha no visual da Nexora antiga

Cada rota recebe o TemaNexora por um layout ao lado da pagina. So mudam
classes: o login deixa de ser claro, recuperar/redefinir/verificar deixam
de ter cada um um visual, e o botao do Google continua o oficial branco.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B6Utz2JQKzx3pc9XppjF9B
'@
```

---

### Task 4: O diagnóstico, e a promessa que sobreviveu no arquivo vizinho

**Files:**
- Create: `app/diagnostico/layout.tsx`
- Modify: `app/diagnostico/painel.tsx:315` e `:333-334` (texto), e classes pelo script
- Modify (pelo script): `app/diagnostico/page.tsx`, `components/diagnostico/tres-nomes.tsx`, `components/acao-convite.tsx`
- Test: `tests/tema-funil.test.ts` (acrescentar `describe` no fim)

**Interfaces:**
- Consumes: `TemaNexora`; helpers `achadosDoTemaAntigo`, `aplicaTema`, `leia`, `PROMESSA_EXPORTACAO`, lista `DIAGNOSTICO` da Task 1; script `migrar-tema-funil.mjs` da Task 3 (Step 4).
- Produces: nada que outra task consuma além dos arquivos migrados.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar no fim de `tests/tema-funil.test.ts`:

```ts
describe("o diagnóstico", () => {
  for (const arquivo of DIAGNOSTICO) {
    it(`${arquivo} usa só o tema do funil`, () => {
      expect(achadosDoTemaAntigo(arquivo)).toEqual([]);
    });
  }

  it("/diagnostico recebe o TemaNexora pelo layout", () => {
    aplicaTema("app/diagnostico/layout.tsx");
  });

  it("nenhum arquivo do diagnóstico promete a exportação de conversa do WhatsApp", () => {
    // tests/legal.test.ts só lia app/diagnostico/page.tsx, e a mesma promessa
    // sobreviveu em painel.tsx. A trava agora cobre o diagnóstico inteiro.
    for (const arquivo of DIAGNOSTICO) {
      expect(leia(arquivo), arquivo).not.toMatch(PROMESSA_EXPORTACAO);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run tests/tema-funil.test.ts -t "o diagnóstico"`
Expected: FAIL — `page.tsx`, `painel.tsx`, `tres-nomes.tsx` e `acao-convite.tsx` listam tokens antigos (e `painel.tsx` também os hex `#FAF8F2`, `#3A372C`...); `layout.tsx` dá ENOENT; a trava de promessa falha apontando `app/diagnostico/painel.tsx`. `components/funil.tsx` já passa (não tem visual).

- [ ] **Step 3: Corrigir o texto da promessa**

Em `app/diagnostico/painel.tsx`, trocar:

```tsx
          {e.texto ? `${contarLinhas(e.texto)} linhas coladas` : "CSV, TXT ou conversa do WhatsApp"}
```

por:

```tsx
          {e.texto ? `${contarLinhas(e.texto)} linhas coladas` : "CSV ou TXT"}
```

E trocar:

```tsx
            <strong className="text-mist">Só tenho o WhatsApp:</strong> abre a conversa,
            Mais → Exportar conversa → Sem mídia, e cola o texto aqui.
```

por:

```tsx
            <strong className="text-mist">Só tenho o WhatsApp:</strong> abre as conversas e
            digita aqui nome e número de quem sumiu, um por linha.
```

- [ ] **Step 4: Criar o layout do diagnóstico**

Criar `app/diagnostico/layout.tsx`:

```tsx
import { TemaNexora } from "@/components/tema-nexora";

// Funil público: esta tela usa o visual da Nexora antiga (components/tema-nexora.tsx).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <TemaNexora>{children}</TemaNexora>;
}
```

- [ ] **Step 5: Rodar o script nos quatro arquivos com visual**

Run: `node "C:\Users\eli\AppData\Local\Temp\claude\C--Users-eli\88eed0d9-8968-478b-9b41-c05c288da55b\scratchpad\migrar-tema-funil.mjs" app/diagnostico/page.tsx app/diagnostico/painel.tsx components/diagnostico/tres-nomes.tsx components/acao-convite.tsx`
Expected: as quatro linhas dizem `migrado`. Se o arquivo do script não existir (execução fora de ordem), criá-lo com o conteúdo da Task 3, Step 4, antes.

- [ ] **Step 6: Rodar e ver passar — a trava nova e as que leem o diagnóstico**

Run: `pnpm exec vitest run tests/tema-funil.test.ts tests/legal.test.ts tests/contato.test.ts tests/declaracao.test.ts tests/formas-pagamento.test.ts`
Expected: PASS. Sobra de classe antiga com prefixo não previsto: trocar à mão pela tabela e rodar de novo.

- [ ] **Step 7: Revisar o diff**

Run: `git diff -- app/diagnostico components/diagnostico components/acao-convite.tsx`
Expected: além das duas frases do Step 3, só mudam `className`. O cartão "Não compre a Nexora agora" vira `border border-nx-gold/30 bg-nx-surface` com botão `border border-nx-border bg-nx-surface-2 ... text-nx-primary`. As duas variantes do `AcaoConvite` ficam `border-nx-gold/40 text-nx-gold hover:bg-nx-gold/10` (escuro) e `border-nx-border text-nx-primary hover:border-nx-gold` (claro).

- [ ] **Step 8: Commit**

```powershell
git add -- app/diagnostico components/diagnostico/tres-nomes.tsx components/acao-convite.tsx tests/tema-funil.test.ts
git commit -m @'
funil: diagnostico no visual da Nexora antiga

Layout com TemaNexora, classes trocadas pela tabela do spec e o cartao do
corte honesto sai do papel. O painel ainda mandava exportar a conversa do
WhatsApp, que rende um cliente sem telefone; a trava agora le o
diagnostico inteiro, nao so a page.tsx.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B6Utz2JQKzx3pc9XppjF9B
'@
```

---

### Task 5: A fronteira fechada e a conferência

**Files:**
- Test: `tests/tema-funil.test.ts` (acrescentar `describe` no fim)
- Nenhum arquivo de produção muda, salvo correção de algo que a conferência encontrar.

**Interfaces:**
- Consumes: `RAIZ`, `leia`, `PREFIXO`, `PROMESSA_EXPORTACAO`, `FUNIL` da Task 1; imports `existsSync`, `readdirSync`, `dirname`, `relative`, `resolve`, `sep` já declarados no topo do arquivo de teste.

- [ ] **Step 1: Escrever as travas de fronteira**

Acrescentar no fim de `tests/tema-funil.test.ts`:

```ts
describe("a fronteira do funil", () => {
  const TOKEN_NX = new RegExp(`(?<![\\w-])(?:[a-z-]+:)*${PREFIXO}-nx-[\\w/-]*`, "g");

  function listar(dir: string): string[] {
    return readdirSync(join(RAIZ, dir), { withFileTypes: true }).flatMap((e) => {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) return listar(rel);
      return /\.tsx?$/.test(e.name) ? [rel] : [];
    });
  }

  function importsLocais(rel: string): string[] {
    const fonte = leia(rel);
    return [...fonte.matchAll(/from\s+["']((?:@\/components\/|\.{1,2}\/)[^"']+)["']/g)].map(
      ([, alvo]) => {
        const base = alvo.startsWith("@/")
          ? join(RAIZ, alvo.slice(2))
          : resolve(dirname(join(RAIZ, rel)), alvo);
        const achado = [".tsx", ".ts", "/index.tsx", "/index.ts"]
          .map((ext) => base + ext)
          .find((p) => existsSync(p));
        return achado ? relative(RAIZ, achado).split(sep).join("/") : `${alvo} (não resolvido)`;
      },
    );
  }

  it("fora do funil ninguém usa nx-* nem o TemaNexora", () => {
    const fora = [...listar("app"), ...listar("components")].filter((f) => !FUNIL.includes(f));
    const vazamentos = fora.flatMap((arquivo) => {
      const fonte = leia(arquivo);
      const achados = [...(fonte.match(TOKEN_NX) ?? [])];
      if (fonte.includes("tema-nexora")) achados.push("import do TemaNexora");
      return achados.map((a) => `${arquivo}: ${a}`);
    });
    expect(vazamentos).toEqual([]);
  });

  it("todo componente que o funil importa está na lista do funil", () => {
    // Uma lista escrita à mão envelhece no primeiro componente novo. Seguindo
    // os imports, quem entrar no diagnóstico amanhã entra na trava junto.
    const escapados = FUNIL.flatMap((arquivo) =>
      importsLocais(arquivo)
        .filter((destino) => !FUNIL.includes(destino))
        .map((destino) => `${arquivo} importa ${destino}`),
    );
    expect(escapados).toEqual([]);
  });

  it("nenhuma tela do funil promete a exportação de conversa do WhatsApp", () => {
    for (const arquivo of FUNIL) {
      expect(leia(arquivo), arquivo).not.toMatch(PROMESSA_EXPORTACAO);
    }
  });
});
```

- [ ] **Step 2: Rodar — são travas, devem passar já**

Run: `pnpm exec vitest run tests/tema-funil.test.ts -t "fronteira"`
Expected: PASS em 3. Uma trava que nunca falhou não provou nada — os Steps 3 e 4 provam.

- [ ] **Step 3: Provar que a trava de vazamento falha**

Acrescentar temporariamente, no fim de `app/painel/page.tsx`, a linha:

```tsx
export const _provaDaTrava = "text-nx-gold";
```

Run: `pnpm exec vitest run tests/tema-funil.test.ts -t "ninguém usa"`
Expected: FAIL com `app/painel/page.tsx: text-nx-gold`.

Desfazer: `git checkout -- app/painel/page.tsx`
Run: `pnpm exec vitest run tests/tema-funil.test.ts -t "ninguém usa"`
Expected: PASS.

- [ ] **Step 4: Provar que a trava de imports falha**

Em `components/acao-convite.tsx`, trocar temporariamente:

```tsx
import { useState } from "react";
```

por:

```tsx
import { useState } from "react";
import { LogoutButton } from "@/components/logout-button";
```

Run: `pnpm exec vitest run tests/tema-funil.test.ts -t "está na lista do funil"`
Expected: FAIL com `components/acao-convite.tsx importa components/logout-button.tsx`.

Desfazer: `git checkout -- components/acao-convite.tsx`
Run: `pnpm exec vitest run tests/tema-funil.test.ts -t "está na lista do funil"`
Expected: PASS.

- [ ] **Step 5: Suíte inteira e tipos**

Run: `pnpm test`
Expected: PASS em todos os arquivos (eram 613 testes antes deste trabalho; agora 613 + os de `tema-funil`).

Run: `pnpm typecheck`
Expected: sem erros.

- [ ] **Step 6: Nada fora do alcance mudou**

Run: `git diff --stat cc0a324..HEAD -- app/painel app/agendar app/termos app/privacidade app/operador app/descadastro app/legal.tsx app/error.tsx app/not-found.tsx ../app`
Expected: saída vazia.

- [ ] **Step 7: Build e pré-carregamento de fontes**

Run: `pnpm build`
Expected: build conclui. Se cair por falta de memória, fechar o que estiver aberto e rodar de novo antes de tratar como erro de código.

Contar `as="font"` em `.next/server/app/index.html` e em `.next/server/app/termos.html` (Grep, modo count, com o caminho do arquivo explícito).
Expected: a home tem pré-carregamento (a Geist) e `/termos` tem zero, ou seja, as fontes antigas não são mais pré-carregadas. Se `termos.html` não existir (rota dinâmica), usar `privacidade.html`.

- [ ] **Step 8: Conferência visual das 7 telas**

Subir o servidor em segundo plano, com o banco apontado para lugar nenhum e o worker de follow-up sem rodar durante a conferência (variáveis só neste processo; o `.env` não é lido nem impresso):

Run (background): `$env:DATABASE_URL='postgresql://verificacao-visual@127.0.0.1:1/nada'; $env:FOLLOWUP_INTERVAL_MINUTES='30000'; pnpm exec next dev -p 3002`

Com o Playwright, para cada endereço — `/`, `/diagnostico`, `/cadastro`, `/login`, `/recuperar`, `/redefinir`, `/redefinir?token=conferencia`, `/verificar` — em 390×844 e em 1280×800:
1. Navegar e tirar screenshot.
2. Avaliar `document.documentElement.scrollWidth <= window.innerWidth` → `true` (sem rolagem lateral).
3. Avaliar `getComputedStyle(document.querySelector('.tema-nx')).backgroundColor` → `rgb(10, 10, 15)`.
4. Avaliar `getComputedStyle(document.querySelector('h1') ?? document.body).fontFamily` → contém `Geist`.

Não enviar formulário nenhum. Comparar as screenshots com o mockup aprovado: hero centralizado, botão dourado com brilho, selos ✓ verdes, lista "Onda de segunda" com selo "exemplo".

Em `/login`, apertar Tab uma vez e tirar screenshot: o link do logo mostra o contorno de foco âmbar, e não o verde de antes.

Abrir `/termos` em 1280×800 e tirar screenshot: continua no fundo papel.

Parar o servidor: `Get-NetTCPConnection -LocalPort 3002 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`

- [ ] **Step 9: Commit**

```powershell
git add -- tests/tema-funil.test.ts
git commit -m @'
funil: trava da fronteira entre os dois temas

nx-* e TemaNexora nao vazam para painel, juridico e agendamento; todo
componente importado pelo funil entra na trava; e nenhuma tela do funil
promete a exportacao de conversa do WhatsApp. As duas primeiras foram
provadas falhando antes de passar.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B6Utz2JQKzx3pc9XppjF9B
'@
```

- [ ] **Step 10: Relatório ao dono**

Relatar: o que mudou por tela, as screenshots, o resultado da suíte, do typecheck e do build, e o que ficou para os sub-projetos 2 a 4. Push e deploy são ações de fora do repositório: perguntar antes.
