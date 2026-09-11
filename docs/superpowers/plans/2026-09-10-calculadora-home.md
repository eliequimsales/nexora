# Calculadora da home — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A home ganha a calculadora interativa no bloco "A conta que ninguém faz", com a mesma fórmula do diagnóstico e dois eventos anônimos de funil.

**Architecture:** A fórmula sai de `gerarDiagnostico` para `lib/recuperacao/estimativa.ts`, usada pelo diagnóstico e pela calculadora. A conta da calculadora e o link para o diagnóstico são funções puras em `lib/recuperacao/calculadora.ts`; o componente `components/calculadora.tsx` só desenha e chama essas funções. A medição acrescenta dois nomes à lista fechada de `lib/funil.ts`, e a política de privacidade declara isso.

**Tech Stack:** Next.js 14.2 App Router, React 18, Tailwind 3.4 (tokens `nx-*`), vitest 1.6, pnpm 10.33.

**Spec:** `docs/superpowers/specs/2026-09-10-calculadora-home-design.md`

## Global Constraints

- Caminhos relativos a `apps/recepcionista`, salvo quando começam na raiz do monorepo. Comandos em PowerShell com `pnpm -C 'C:\Users\eli\Downloads\Documents\saas-platform\apps\recepcionista'` e `git -C 'C:\Users\eli\Downloads\Documents\saas-platform'`.
- Branch: `feat/calculadora-home`. Nada vai para a `main` nem para o GitHub sem o dono pedir.
- Fórmula: 15% a 25% (`TAXA_MIN = 0.15`, `TAXA_MAX = 0.25`), janela de 90 dias, visitas = round(90 / ciclo) entre 1 e 4, corte honesto com menos de 25 sumidos ou mínimo abaixo de R$ 500 (50.000 centavos). Nenhum desses números escrito fora de `lib/recuperacao/estimativa.ts`.
- Ritmo da calculadora: `MEDIANA_POR_SEGMENTO.padrao` (30 dias). A calculadora não pergunta o ramo.
- Eventos novos, e só eles: `usou_calculadora` (1 vez por sessão da aba, marca `nx_calc` no `sessionStorage`) e `clicou_calculadora` (clique no botão para o diagnóstico, 1 vez por visita à página). Só o nome do evento sai do navegador.
- O botão leva só `ticket` (inteiro de R$ 5 a R$ 5.000) e `c` (criativo higienizado) para `/diagnostico`.
- `VERSAO_DOCUMENTOS` passa a `"2026-09-10"`.
- Tema: só tokens `nx-*`; nada de `night`, `mist`, `paper`, `panel`, `amber`, `leaf`, `font-display`, `bg-white`. Ícones `→` e `✓`.
- `app/page.tsx` continua sem "cnpj", "boleto" e "pix" em qualquer parte.
- Nunca ler nem imprimir `.env`. Com `next dev` de pé, não rodar `pnpm test` (o `prisma generate` falha com EPERM).
- TDD: teste falhando antes de cada mudança de produção.
- Commits em português sem acento, terminando com:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` e
  `Claude-Session: https://claude.ai/code/session_01JDpp1rGVVXHuqD6VsRFBse`

---

### Task 1: A fórmula compartilhada

**Files:**
- Create: `lib/recuperacao/estimativa.ts`
- Modify: `lib/importacao/diagnostico.ts:19-32`, `:164-179`, `:217`, `:254-255`, `:268`
- Test: `tests/estimativa.test.ts` (novo); `tests/importacao.test.ts`, `tests/diagnostico-funil.test.ts`, `tests/genero.test.ts` sem mudança

**Interfaces:**
- Produces: `TAXA_MIN: number`, `TAXA_MAX: number`, `JANELA_DIAS: number`, `MAX_VISITAS_PROJETADAS: number`, `MIN_SUMIDOS: number`, `MIN_RECUPERAVEL_CENTS: number`, `FAIXA_EM_TEXTO: string`, `visitasNaJanela(cicloDias: number): number`, `faixaRecuperavel(potencialCents: number): { min: number; central: number; max: number }`, `abaixoDoCorte(sumidos: number, minCents: number): boolean` — todos de `@/lib/recuperacao/estimativa`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/estimativa.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FAIXA_EM_TEXTO,
  JANELA_DIAS,
  MAX_VISITAS_PROJETADAS,
  MIN_RECUPERAVEL_CENTS,
  MIN_SUMIDOS,
  TAXA_MAX,
  TAXA_MIN,
  abaixoDoCorte,
  faixaRecuperavel,
  visitasNaJanela,
} from "@/lib/recuperacao/estimativa";

/**
 * A CONTA DO DINHEIRO RECUPERÁVEL MORA NUM LUGAR SÓ.
 *
 * A calculadora da home e o diagnóstico dizem ao dono quanto dinheiro está
 * parado. Com uma fórmula em cada tela, bastava ajustar a taxa num lugar para a
 * home prometer um valor e o diagnóstico mostrar outro para a mesma base.
 */

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("a regra", () => {
  it("são as taxas, a janela e os limites que o diagnóstico sempre usou", () => {
    expect(TAXA_MIN).toBe(0.15);
    expect(TAXA_MAX).toBe(0.25);
    expect(JANELA_DIAS).toBe(90);
    expect(MAX_VISITAS_PROJETADAS).toBe(4);
    expect(MIN_SUMIDOS).toBe(25);
    expect(MIN_RECUPERAVEL_CENTS).toBe(50_000);
  });

  it("o texto da faixa sai das taxas", () => {
    expect(FAIXA_EM_TEXTO).toBe("15% a 25%");
  });
});

describe("visitas na janela de 90 dias", () => {
  it("quem volta a cada 30 dias volta 3 vezes", () => {
    expect(visitasNaJanela(30)).toBe(3);
  });

  it("arredonda: 24 dias dá 4 visitas", () => {
    expect(visitasNaJanela(24)).toBe(4);
  });

  it("nunca menos de 1: ciclo de 180 dias ainda conta a volta", () => {
    expect(visitasNaJanela(180)).toBe(1);
  });

  it("nunca mais de 4: ciclo semanal não vira 13 idas seguidas", () => {
    expect(visitasNaJanela(7)).toBe(4);
    expect(visitasNaJanela(0)).toBe(4);
  });
});

describe("faixa recuperável", () => {
  it("15% e 25% do potencial, com a média no meio", () => {
    expect(faixaRecuperavel(5_400_000)).toEqual({ min: 810_000, central: 1_080_000, max: 1_350_000 });
  });

  it("potencial zero é faixa zero", () => {
    expect(faixaRecuperavel(0)).toEqual({ min: 0, central: 0, max: 0 });
  });
});

describe("corte honesto", () => {
  it("menos de 25 sumidos fica abaixo do corte", () => {
    expect(abaixoDoCorte(24, 1_000_000)).toBe(true);
  });

  it("25 sumidos com R$ 500 no mínimo passa", () => {
    expect(abaixoDoCorte(25, 50_000)).toBe(false);
  });

  it("um centavo abaixo de R$ 500 fica abaixo do corte", () => {
    expect(abaixoDoCorte(25, 49_999)).toBe(true);
  });
});

describe("o diagnóstico usa esta conta, e não uma cópia", () => {
  const fonte = semComentarios(
    readFileSync(join(__dirname, "..", "lib/importacao/diagnostico.ts"), "utf8"),
  );

  it("importa a fórmula de lib/recuperacao/estimativa", () => {
    expect(fonte).toMatch(/from\s+["']@\/lib\/recuperacao\/estimativa["']/);
  });

  it("não declara as próprias taxas nem limites", () => {
    for (const nome of [
      "TAXA_MIN",
      "TAXA_MAX",
      "JANELA_DIAS",
      "MAX_VISITAS_PROJETADAS",
      "MIN_SUMIDOS",
      "MIN_RECUPERAVEL_CENTS",
    ]) {
      expect(fonte, nome).not.toMatch(new RegExp(`const\\s+${nome}\\s*=`));
    }
  });

  it("não escreve a faixa nem a janela à mão", () => {
    expect(fonte).not.toContain("15% a 25%");
    expect(fonte).not.toMatch(/\b90 dias\b/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm -C 'C:\Users\eli\Downloads\Documents\saas-platform\apps\recepcionista' exec vitest run tests/estimativa.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/recuperacao/estimativa"`.

- [ ] **Step 3: Criar a fórmula**

Criar `lib/recuperacao/estimativa.ts`:

```ts
/**
 * A CONTA DO DINHEIRO RECUPERÁVEL — um lugar só.
 *
 * Duas telas dizem ao dono quanto dinheiro está parado: a calculadora da home,
 * com três números que ele digita, e o diagnóstico, com a lista dele. Se cada
 * uma tivesse a própria fórmula, bastaria alguém ajustar a taxa num lugar para
 * a home prometer um valor e o diagnóstico mostrar outro — para a mesma base.
 *
 * Por isso a regra mora aqui e as duas importam. tests/estimativa.test.ts
 * reprova se o diagnóstico voltar a declarar as próprias taxas.
 */

/** Faixa de reativação observada em campanhas de recuperação, em 90 dias. */
export const TAXA_MIN = 0.15;
export const TAXA_MAX = 0.25;
export const JANELA_DIAS = 90;
/** Teto de visitas projetadas. Ciclo semanal daria 13 na janela — projetar
 *  isso é fantasia, ninguém recupera alguém e mantém 13 idas seguidas. */
export const MAX_VISITAS_PROJETADAS = 4;

/** Abaixo disto não há o que recuperar: o Corte Honesto entra. */
export const MIN_SUMIDOS = 25;
export const MIN_RECUPERAVEL_CENTS = 50_000;

const porcento = (taxa: number) => `${Math.round(taxa * 100)}%`;

/** "15% a 25%", derivado das taxas: o texto nunca envelhece sozinho. */
export const FAIXA_EM_TEXTO = `${porcento(TAXA_MIN)} a ${porcento(TAXA_MAX)}`;

/**
 * Quantas vezes o cliente recuperado voltaria na janela, retomando o ciclo
 * dele. Contar só uma subestima em 3x — subestimar também é impreciso.
 */
export function visitasNaJanela(cicloDias: number): number {
  return Math.max(
    1,
    Math.min(MAX_VISITAS_PROJETADAS, Math.round(JANELA_DIAS / Math.max(1, cicloDias))),
  );
}

export function faixaRecuperavel(potencialCents: number): {
  min: number;
  central: number;
  max: number;
} {
  const min = Math.round(potencialCents * TAXA_MIN);
  const max = Math.round(potencialCents * TAXA_MAX);
  return { min, central: Math.round((min + max) / 2), max };
}

export function abaixoDoCorte(sumidos: number, minCents: number): boolean {
  return sumidos < MIN_SUMIDOS || minCents < MIN_RECUPERAVEL_CENTS;
}
```

- [ ] **Step 4: O diagnóstico passa a importar a fórmula**

Em `lib/importacao/diagnostico.ts`, trocar:

```ts
import { calcularCiclo } from "@/lib/recuperacao/ciclo";
import { classificar } from "@/lib/recuperacao/esteiras";

/** Faixa de reativação observada em campanhas de recuperação, em 90 dias. */
const TAXA_MIN = 0.15;
const TAXA_MAX = 0.25;
const JANELA_DIAS = 90;
/** Teto de visitas projetadas. Ciclo semanal daria 13 na janela — projetar
 *  isso é fantasia, ninguém recupera alguém e mantém 13 idas seguidas. */
const MAX_VISITAS_PROJETADAS = 4;

/** Abaixo disto não há o que recuperar: o Corte Honesto entra. */
const MIN_SUMIDOS = 25;
const MIN_RECUPERAVEL_CENTS = 50_000;
```

por:

```ts
import { calcularCiclo } from "@/lib/recuperacao/ciclo";
import { classificar } from "@/lib/recuperacao/esteiras";
// A fórmula do dinheiro mora em lib/recuperacao/estimativa.ts, e a calculadora
// da home usa a mesma. Nunca declarar taxa ou limite aqui de novo.
import {
  FAIXA_EM_TEXTO,
  JANELA_DIAS,
  abaixoDoCorte,
  faixaRecuperavel,
  visitasNaJanela,
} from "@/lib/recuperacao/estimativa";
```

Trocar:

```ts
  // Quantas vezes o cliente recuperado voltaria na janela, retomando o ciclo
  // dele. Contar só uma subestima em 3x — subestimar também é impreciso.
  const cicloMedio = sumidos.length
    ? Math.round(sumidos.reduce((s, a) => s + a.ciclo.dias, 0) / sumidos.length)
    : mediana;
  const visitasEsperadas = Math.max(
    1,
    Math.min(MAX_VISITAS_PROJETADAS, Math.round(JANELA_DIAS / Math.max(1, cicloMedio))),
  );

  const somaTickets = sumidos.reduce((s, a) => s + a.ticket, 0);
  const potencial = somaTickets * visitasEsperadas;

  const min = Math.round(potencial * TAXA_MIN);
  const max = Math.round(potencial * TAXA_MAX);
  const central = Math.round((min + max) / 2);
```

por:

```ts
  const cicloMedio = sumidos.length
    ? Math.round(sumidos.reduce((s, a) => s + a.ciclo.dias, 0) / sumidos.length)
    : mediana;
  const visitasEsperadas = visitasNaJanela(cicloMedio);

  const somaTickets = sumidos.reduce((s, a) => s + a.ticket, 0);
  const potencial = somaTickets * visitasEsperadas;

  const { min, central, max } = faixaRecuperavel(potencial);
```

Trocar:

```ts
    : sumidos.length < MIN_SUMIDOS || min < MIN_RECUPERAVEL_CENTS;
```

por:

```ts
    : abaixoDoCorte(sumidos.length, min);
```

Trocar:

```ts
      `Usamos o ticket e a frequência dos SEUS registros, e a faixa de 15% a 25% de retorno que ` +
      `campanhas de recuperação costumam dar em 90 dias. Projetamos ${visitasEsperadas} ` +
```

por:

```ts
      `Usamos o ticket e a frequência dos SEUS registros, e a faixa de ${FAIXA_EM_TEXTO} de retorno que ` +
      `campanhas de recuperação costumam dar em ${JANELA_DIAS} dias. Projetamos ${visitasEsperadas} ` +
```

Trocar:

```ts
        `recuperáveis nos próximos 90 dias.`,
```

por:

```ts
        `recuperáveis nos próximos ${JANELA_DIAS} dias.`,
```

- [ ] **Step 5: Rodar e ver passar — a fórmula nova e os números antigos do diagnóstico**

Run: `pnpm -C 'C:\Users\eli\Downloads\Documents\saas-platform\apps\recepcionista' exec vitest run tests/estimativa.test.ts tests/importacao.test.ts tests/diagnostico-funil.test.ts tests/genero.test.ts`
Expected: PASS em todos. `importacao.test.ts` continua com 3 visitas, R$ 45 a R$ 75 e R$ 2.160 — se algum desses mudar, a extração alterou a conta: parar e corrigir.

- [ ] **Step 6: Commit**

```powershell
git -C 'C:\Users\eli\Downloads\Documents\saas-platform' add -- apps/recepcionista/lib/recuperacao/estimativa.ts apps/recepcionista/lib/importacao/diagnostico.ts apps/recepcionista/tests/estimativa.test.ts
git -C 'C:\Users\eli\Downloads\Documents\saas-platform' commit -m @'
recuperacao: a formula do dinheiro recuperavel num lugar so

Taxas, janela, teto de visitas e corte honesto saem de gerarDiagnostico para
lib/recuperacao/estimativa.ts, que a calculadora da home vai usar. Os numeros
exatos do diagnostico nao mudam; o texto do metodo passa a sair das
constantes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JDpp1rGVVXHuqD6VsRFBse
'@
```

---

### Task 2: A conta da calculadora

**Files:**
- Create: `lib/recuperacao/calculadora.ts`
- Test: `tests/calculadora.test.ts` (novo)

**Interfaces:**
- Consumes: `visitasNaJanela`, `faixaRecuperavel`, `abaixoDoCorte` (Task 1); `MEDIANA_POR_SEGMENTO` de `@/lib/recuperacao/ciclo`; `limparCriativo` de `@/lib/funil`.
- Produces (de `@/lib/recuperacao/calculadora`): `FATIAS: readonly [0.2, 0.3, 0.4]`, `type Fatia = 0.2 | 0.3 | 0.4`, `EXEMPLO: { clientes: number; ticketReais: number; fatia: Fatia }`, `CICLO_DA_CALCULADORA: number`, `MAX_CLIENTES = 1_000_000`, `MAX_TICKET_REAIS = 100_000`, `lerInteiro(bruto: string, maximo: number): number`, `type ContaDaCalculadora`, `contaDaCalculadora(entrada: { clientes: number; ticketReais: number; fatia: number }): ContaDaCalculadora`, `linkDoDiagnostico(entrada: { ticketReais: number; criativo: string | null }): string`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/calculadora.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CICLO_DA_CALCULADORA,
  EXEMPLO,
  FATIAS,
  MAX_CLIENTES,
  contaDaCalculadora,
  lerInteiro,
  linkDoDiagnostico,
} from "@/lib/recuperacao/calculadora";
import { MEDIANA_POR_SEGMENTO } from "@/lib/recuperacao/ciclo";
import { lerParametros } from "@/lib/diagnostico/parametros";

/**
 * A CALCULADORA DA HOME FAZ A CONTA DO DIAGNÓSTICO.
 *
 * Três números que o visitante digita, a fórmula de lib/recuperacao/estimativa.
 * A única suposição a mais é o ritmo — e ela é a mesma que o diagnóstico usa
 * para quem não informou o ramo.
 */

describe("a conta da calculadora é a conta do diagnóstico", () => {
  it("o exemplo da tela: 400 clientes, R$ 150, 30%", () => {
    expect(contaDaCalculadora(EXEMPLO)).toEqual({
      parados: 120,
      umaVisitaCents: 1_800_000,
      visitas: 3,
      potencialCents: 5_400_000,
      faixa: { min: 810_000, central: 1_080_000, max: 1_350_000 },
      abaixoDoCorte: false,
    });
  });

  it("assume o ritmo padrão do diagnóstico", () => {
    expect(CICLO_DA_CALCULADORA).toBe(MEDIANA_POR_SEGMENTO.padrao);
    expect(CICLO_DA_CALCULADORA).toBe(30);
  });

  it("as fatias são 20%, 30% e 40%, e o exemplo usa uma delas", () => {
    expect([...FATIAS]).toEqual([0.2, 0.3, 0.4]);
    expect(FATIAS).toContain(EXEMPLO.fatia);
  });
});

describe("o corte honesto aparece na calculadora também", () => {
  it("poucos parados ficam abaixo do corte", () => {
    expect(contaDaCalculadora({ clientes: 50, ticketReais: 150, fatia: 0.3 }).abaixoDoCorte).toBe(true);
  });

  it("campo vazio não é recusa: sem número não há conta", () => {
    const semClientes = contaDaCalculadora({ clientes: 0, ticketReais: 150, fatia: 0.3 });
    expect(semClientes.faixa).toEqual({ min: 0, central: 0, max: 0 });
    expect(semClientes.abaixoDoCorte).toBe(false);
    expect(contaDaCalculadora({ clientes: 400, ticketReais: 0, fatia: 0.3 }).abaixoDoCorte).toBe(false);
  });
});

describe("o que o visitante digita", () => {
  it("só dígitos contam", () => {
    expect(lerInteiro("1.200", MAX_CLIENTES)).toBe(1200);
    expect(lerInteiro("R$ 150", 100_000)).toBe(150);
  });

  it("vazio ou texto vale 0, sem erro", () => {
    expect(lerInteiro("", MAX_CLIENTES)).toBe(0);
    expect(lerInteiro("abc", MAX_CLIENTES)).toBe(0);
  });

  it("respeita o teto", () => {
    expect(lerInteiro("99999999", MAX_CLIENTES)).toBe(MAX_CLIENTES);
  });
});

describe("o botão leva o ticket ao diagnóstico pela URL", () => {
  const ler = (link: string) =>
    lerParametros(Object.fromEntries(new URLSearchParams(link.split("?")[1] ?? "")));

  it("ticket dentro da faixa vai, e o diagnóstico lê o mesmo valor", () => {
    const link = linkDoDiagnostico({ ticketReais: 150, criativo: null });
    expect(link).toBe("/diagnostico?ticket=150");
    expect(ler(link).ticketReais).toBe("150");
  });

  it("ticket fora da faixa do diagnóstico não vai", () => {
    expect(linkDoDiagnostico({ ticketReais: 4, criativo: null })).toBe("/diagnostico");
    expect(linkDoDiagnostico({ ticketReais: 5001, criativo: null })).toBe("/diagnostico");
    expect(linkDoDiagnostico({ ticketReais: 0, criativo: null })).toBe("/diagnostico");
  });

  it("as bordas da faixa vão", () => {
    expect(linkDoDiagnostico({ ticketReais: 5, criativo: null })).toBe("/diagnostico?ticket=5");
    expect(linkDoDiagnostico({ ticketReais: 5000, criativo: null })).toBe("/diagnostico?ticket=5000");
  });

  it("o criativo do anúncio segue junto, só se for identificador válido", () => {
    const link = linkDoDiagnostico({ ticketReais: 150, criativo: "Bar-A1" });
    expect(link).toBe("/diagnostico?ticket=150&c=bar-a1");
    expect(ler(link).criativo).toBe("bar-a1");
    expect(linkDoDiagnostico({ ticketReais: 150, criativo: "<script>" })).toBe("/diagnostico?ticket=150");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm -C 'C:\Users\eli\Downloads\Documents\saas-platform\apps\recepcionista' exec vitest run tests/calculadora.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/recuperacao/calculadora"`.

- [ ] **Step 3: Criar a conta**

Criar `lib/recuperacao/calculadora.ts`:

```ts
import { limparCriativo } from "@/lib/funil";
import { MEDIANA_POR_SEGMENTO } from "@/lib/recuperacao/ciclo";
import { abaixoDoCorte, faixaRecuperavel, visitasNaJanela } from "@/lib/recuperacao/estimativa";

/**
 * A CONTA DA CALCULADORA DA HOME.
 *
 * Três números que o visitante digita e a mesma fórmula do diagnóstico
 * (lib/recuperacao/estimativa.ts). A única suposição a mais é o ritmo: sem
 * saber o ramo, a calculadora usa o padrão do próprio diagnóstico — e a tela
 * diz isso.
 *
 * Funções puras: o componente só desenha. Assim a conta é testada sem React.
 */

export const FATIAS = [0.2, 0.3, 0.4] as const;
export type Fatia = (typeof FATIAS)[number];

/** O que a calculadora mostra antes de o visitante digitar. A tela diz que é exemplo. */
export const EXEMPLO: { clientes: number; ticketReais: number; fatia: Fatia } = {
  clientes: 400,
  ticketReais: 150,
  fatia: 0.3,
};

/** O ritmo que a calculadora assume: o padrão do diagnóstico para quem não informou o ramo. */
export const CICLO_DA_CALCULADORA = MEDIANA_POR_SEGMENTO.padrao;

export const MAX_CLIENTES = 1_000_000;
export const MAX_TICKET_REAIS = 100_000;

/** A mesma faixa de lib/diagnostico/parametros.ts: R$ 5 a R$ 5.000. */
const TICKET_MIN_NO_LINK = 5;
const TICKET_MAX_NO_LINK = 5_000;

/** Só dígitos, dentro do teto. Campo vazio ou texto vale 0. */
export function lerInteiro(bruto: string, maximo: number): number {
  const n = Number(bruto.replace(/\D/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, maximo);
}

export type ContaDaCalculadora = {
  parados: number;
  umaVisitaCents: number;
  visitas: number;
  potencialCents: number;
  faixa: { min: number; central: number; max: number };
  abaixoDoCorte: boolean;
};

export function contaDaCalculadora(entrada: {
  clientes: number;
  ticketReais: number;
  fatia: number;
}): ContaDaCalculadora {
  const clientes = Math.max(0, Math.floor(entrada.clientes));
  const ticketCents = Math.max(0, Math.round(entrada.ticketReais * 100));
  const parados = Math.round(clientes * entrada.fatia);
  const umaVisitaCents = parados * ticketCents;
  const visitas = visitasNaJanela(CICLO_DA_CALCULADORA);
  const potencialCents = umaVisitaCents * visitas;
  const faixa = faixaRecuperavel(potencialCents);
  return {
    parados,
    umaVisitaCents,
    visitas,
    potencialCents,
    faixa,
    // Com campo vazio não há conta. Dizer "não compensa" para quem ainda não
    // digitou seria recusar a venda por falta de dado, e não de oportunidade.
    abaixoDoCorte: clientes > 0 && ticketCents > 0 && abaixoDoCorte(parados, faixa.min),
  };
}

/**
 * O botão leva ao diagnóstico só o que ele sabe usar: o ticket e o criativo do
 * anúncio. Número de clientes e percentual ficam na tela — URL vai para o
 * histórico do navegador, e o diagnóstico não precisa deles.
 */
export function linkDoDiagnostico(entrada: { ticketReais: number; criativo: string | null }): string {
  const params = new URLSearchParams();
  const ticket = Math.round(entrada.ticketReais);
  if (Number.isFinite(ticket) && ticket >= TICKET_MIN_NO_LINK && ticket <= TICKET_MAX_NO_LINK) {
    params.set("ticket", String(ticket));
  }
  const criativo = limparCriativo(entrada.criativo);
  if (criativo) params.set("c", criativo);
  const query = params.toString();
  return query ? `/diagnostico?${query}` : "/diagnostico";
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm -C 'C:\Users\eli\Downloads\Documents\saas-platform\apps\recepcionista' exec vitest run tests/calculadora.test.ts tests/prefill.test.ts`
Expected: PASS em todos.

- [ ] **Step 5: Commit**

```powershell
git -C 'C:\Users\eli\Downloads\Documents\saas-platform' add -- apps/recepcionista/lib/recuperacao/calculadora.ts apps/recepcionista/tests/calculadora.test.ts
git -C 'C:\Users\eli\Downloads\Documents\saas-platform' commit -m @'
recuperacao: a conta da calculadora da home

Clientes x fatia parada x ticket x visitas no ritmo padrao, na formula do
diagnostico; corte honesto so quando ha numero digitado; e o link que leva
ao diagnostico apenas o ticket da faixa aceita e o criativo higienizado.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JDpp1rGVVXHuqD6VsRFBse
'@
```

---

### Task 3: Os dois eventos, o relatório e a política

**Files:**
- Modify: `lib/funil.ts:1-34`
- Modify: `app/api/funil/route.ts:42-43`
- Modify: `app/api/funil/resumo/route.ts:41-47`, `:80-95`
- Modify: `lib/legal/privacidade.ts:40`, `:150`
- Modify: `lib/legal/identidade.ts:23`
- Test: `tests/funil.test.ts:16-31`, `tests/legal.test.ts` (fim do arquivo)

**Interfaces:**
- Produces: `NomeDeEvento` passa a incluir `"usou_calculadora"` e `"clicou_calculadora"`; `registrar("usou_calculadora")` e `registrar("clicou_calculadora")` passam a compilar em `components/funil.tsx`.

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/funil.test.ts`, trocar:

```ts
 * Cinco eventos, nem um a mais. Nunca conteúdo, só o fato de ter acontecido.
 */

describe("a lista de eventos é fechada e pequena", () => {
  it("são exatamente cinco", () => {
    // Cinco cobre o funil inteiro. Vinte viram ninguém olhando nenhum.
    expect(EVENTOS).toHaveLength(5);
  });
```

por:

```ts
 * Sete eventos, nem um a mais. Nunca conteúdo, só o fato de ter acontecido.
 */

describe("a lista de eventos é fechada e pequena", () => {
  it("são exatamente sete", () => {
    // Cinco cobrem do diagnóstico até a conta; os dois da calculadora dizem se a
    // conta da home leva gente ao diagnóstico. Vinte viram ninguém olhando nenhum.
    expect(EVENTOS).toHaveLength(7);
  });

  it("medem a calculadora da home: uso e clique para o diagnóstico", () => {
    expect(EVENTOS).toContain("usou_calculadora");
    expect(EVENTOS).toContain("clicou_calculadora");
  });
```

No fim de `tests/legal.test.ts` (depois do último `});`), acrescentar:

```ts

describe("a medição da calculadora está declarada", () => {
  const priv = textoDe(PRIVACIDADE).toLowerCase();

  it("a política diz que a calculadora entra na medição", () => {
    expect(priv).toContain("calculadora");
  });

  it("e que os números digitados na calculadora não são guardados", () => {
    expect(priv).toContain("não guardam os números que você digita");
  });

  it("a data dos documentos acompanha a mudança", () => {
    // Mudar o texto sem mudar a data faria a própria política mentir sobre quando
    // foi atualizada.
    expect(VERSAO_DOCUMENTOS >= "2026-09-10").toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm -C 'C:\Users\eli\Downloads\Documents\saas-platform\apps\recepcionista' exec vitest run tests/funil.test.ts tests/legal.test.ts`
Expected: FAIL — `expected [...] to have a length of 7 but got 5`; `usou_calculadora` ausente; "calculadora" ausente da política; `"2026-09-01" >= "2026-09-10"` falso.

- [ ] **Step 3: Os dois eventos**

Em `lib/funil.ts`, trocar:

```ts
 * INSTRUMENTAÇÃO DO FUNIL — cinco eventos, nem um a mais.
```

por:

```ts
 * INSTRUMENTAÇÃO DO FUNIL — sete eventos, nem um a mais.
```

Trocar:

```ts
 * POR QUE CINCO, E NÃO VINTE. Cinco cobrem o funil inteiro e cabem numa frase.
 * Vinte viram um painel que ninguém abre, e o Artigo X proíbe dashboard de
 * vaidade. Cada evento aqui responde a uma pergunta que muda uma decisão:
 *
 *   chegou           quanto custou trazer alguém
```

por:

```ts
 * POR QUE SETE, E NÃO VINTE. Sete cobrem o funil inteiro e cabem numa frase.
 * Vinte viram um painel que ninguém abre, e o Artigo X proíbe dashboard de
 * vaidade. Cada evento aqui responde a uma pergunta que muda uma decisão:
 *
 *   usou_calculadora    a conta da home prende quem chegou do anúncio?
 *   clicou_calculadora  a conta da home leva ao diagnóstico?
 *   chegou           quanto custou trazer alguém
```

Trocar:

```ts
export const EVENTOS = [
  "chegou",
```

por:

```ts
export const EVENTOS = [
  "usou_calculadora",
  "clicou_calculadora",
  "chegou",
```

- [ ] **Step 4: O limite da rota continua folgado**

Em `app/api/funil/route.ts`, trocar:

```ts
  // Teto por IP: é rota pública de escrita. Generoso porque uma visita legítima
  // dispara até cinco eventos, mas não infinito.
```

por:

```ts
  // Teto por IP: é rota pública de escrita. Generoso porque uma visita legítima
  // dispara até sete eventos, mas não infinito.
```

- [ ] **Step 5: O relatório mostra a conversão da calculadora**

Em `app/api/funil/resumo/route.ts`, trocar:

```ts
const ROTULO: Record<NomeDeEvento, string> = {
  chegou: "chegou na página",
  comecou_entrada: "começou a escrever",
  viu_numero: "viu o número",
  clicou_mensagem: "clicou para mandar",
  criou_conta: "criou conta",
};
```

por:

```ts
const ROTULO: Record<NomeDeEvento, string> = {
  usou_calculadora: "usou a calculadora (home)",
  clicou_calculadora: "clicou para o diagnóstico (calculadora)",
  chegou: "chegou na página",
  comecou_entrada: "começou a escrever",
  viu_numero: "viu o número",
  clicou_mensagem: "clicou para mandar",
  criou_conta: "criou conta",
};

/**
 * Eventos da home. O percentual das outras linhas é sobre "chegou", que é a
 * chegada no DIAGNÓSTICO — outra página. Para a calculadora, a taxa que decide
 * é a dela mesma: de quem usou, quantos clicaram.
 */
const DA_HOME: readonly NomeDeEvento[] = ["usou_calculadora", "clicou_calculadora"];
```

Trocar:

```ts
    for (const e of EVENTOS) {
      const n = total(e, criativo);
      const pct = base > 0 ? ((100 * n) / base).toFixed(1).padStart(5) : "    -";
      saida.push(`  ${String(n).padStart(6)}  ${pct}%  ${ROTULO[e]}`);
    }
```

por:

```ts
    for (const e of EVENTOS) {
      const n = total(e, criativo);
      const pct =
        base > 0 && !DA_HOME.includes(e) ? ((100 * n) / base).toFixed(1).padStart(5) : "    -";
      saida.push(`  ${String(n).padStart(6)}  ${pct}%  ${ROTULO[e]}`);
    }
    const usou = total("usou_calculadora", criativo);
    if (usou > 0) {
      const clicou = total("clicou_calculadora", criativo);
      saida.push(
        `  ---> calculadora: ${((100 * clicou) / usou).toFixed(1)}% de quem usou clicou para o diagnóstico`,
      );
    }
```

- [ ] **Step 6: A política declara a calculadora**

Em `lib/legal/privacidade.ts`, trocar:

```ts
        "Medição do funil: contamos em que ponto as pessoas desistem do diagnóstico — se travam ao colar a lista, se saem antes de ver o número. O registro guarda o nome da etapa, de qual anúncio a visita veio e um número sorteado que some quando você fecha a aba. Nunca guarda o que foi digitado.",
```

por:

```ts
        "Medição do funil: contamos em que ponto as pessoas desistem — se usam a calculadora da página inicial e seguem para o diagnóstico, se travam ao colar a lista, se saem antes de ver o número. O registro guarda o nome da etapa, de qual anúncio a visita veio e um número sorteado que some quando você fecha a aba. Nunca guarda o que foi digitado — nem na lista, nem na calculadora.",
```

Trocar:

```ts
        "Guardamos também um número sorteado na memória da aba (sessionStorage), que some quando você fecha a aba. Ele serve para uma coisa só: saber em que ponto as pessoas desistem do diagnóstico — se travam ao colar a lista, se desistem antes de ver o número. Não identifica você, não atravessa visitas e não sai daqui.",
```

por:

```ts
        "Guardamos também, na memória da aba (sessionStorage), um número sorteado e uma marca de que a calculadora da página inicial já foi usada — os dois somem quando você fecha a aba. Servem para uma coisa só: saber em que ponto as pessoas desistem — se usam a calculadora e seguem para o diagnóstico, se travam ao colar a lista, se desistem antes de ver o número. Não identificam você, não guardam os números que você digita, não atravessam visitas e não saem daqui.",
```

Em `lib/legal/identidade.ts`, trocar:

```ts
export const VERSAO_DOCUMENTOS = "2026-09-01";
```

por:

```ts
export const VERSAO_DOCUMENTOS = "2026-09-10";
```

- [ ] **Step 7: Rodar e ver passar — eventos, documentos e o que depende da versão**

Run: `pnpm -C 'C:\Users\eli\Downloads\Documents\saas-platform\apps\recepcionista' exec vitest run tests/funil.test.ts tests/legal.test.ts tests/confirmacao.test.ts tests/declaracao.test.ts tests/seguranca-funil.test.ts`
Expected: PASS em todos.

Run: `pnpm -C 'C:\Users\eli\Downloads\Documents\saas-platform\apps\recepcionista' exec tsc --noEmit`
Expected: sem erros (o `Record<NomeDeEvento, string>` do relatório exige os dois rótulos novos).

- [ ] **Step 8: Commit**

```powershell
git -C 'C:\Users\eli\Downloads\Documents\saas-platform' add -- apps/recepcionista/lib/funil.ts apps/recepcionista/app/api/funil/route.ts apps/recepcionista/app/api/funil/resumo/route.ts apps/recepcionista/lib/legal/privacidade.ts apps/recepcionista/lib/legal/identidade.ts apps/recepcionista/tests/funil.test.ts apps/recepcionista/tests/legal.test.ts
git -C 'C:\Users\eli\Downloads\Documents\saas-platform' commit -m @'
funil: os dois eventos da calculadora, declarados na politica

usou_calculadora e clicou_calculadora entram na lista fechada; o resumo
mostra quantos de quem usou clicaram para o diagnostico; a politica diz que
a calculadora e medida e que os numeros digitados nao sao guardados, e a
versao dos documentos acompanha.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JDpp1rGVVXHuqD6VsRFBse
'@
```

---

### Task 4: O componente e a home

**Files:**
- Create: `components/calculadora.tsx`
- Modify: `app/page.tsx` (imports, botão secundário do hero, bloco da conta)
- Test: `tests/calculadora.test.ts` (acrescentar no fim), `tests/tema-funil.test.ts` (lista `HOME` e `describe("a home")`)

**Interfaces:**
- Consumes: tudo de `@/lib/recuperacao/calculadora` (Task 2); `FAIXA_EM_TEXTO`, `JANELA_DIAS` (Task 1); `registrar` de `@/components/funil` com os nomes da Task 3.
- Produces: `Calculadora()` exportado de `@/components/calculadora`; seção `id="calculadora"` na home.

- [ ] **Step 1: Escrever os testes que falham**

No topo de `tests/calculadora.test.ts`, trocar:

```ts
import { describe, expect, it } from "vitest";
```

por:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
```

No fim de `tests/calculadora.test.ts`, acrescentar:

```ts

describe("o componente não inventa número nem guarda o que foi digitado", () => {
  const semComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const componente = () =>
    semComentarios(readFileSync(join(__dirname, "..", "components/calculadora.tsx"), "utf8"));

  it("nenhum número de regra escrito à mão", () => {
    const fonte = componente();
    for (const literal of ["15%", "25%", "0.15", "0.25", "90 dias", "30 dias", "30%"]) {
      expect(fonte, literal).not.toContain(literal);
    }
  });

  it("só registra os dois eventos da calculadora", () => {
    const registrados = [...componente().matchAll(/registrar\(\s*["']([a-z_]+)["']\s*\)/g)]
      .map(([, nome]) => nome)
      .sort();
    expect(registrados).toEqual(["clicou_calculadora", "usou_calculadora"]);
  });

  it("o navegador só guarda a marca de uso, nunca os números", () => {
    const fonte = componente();
    const gravacoes = [...fonte.matchAll(/sessionStorage\.setItem\(([^)]*)\)/g)].map(([, args]) =>
      args.replace(/\s+/g, ""),
    );
    expect(gravacoes).toEqual(['MARCA_DE_USO,"1"']);
    expect(fonte).toContain('const MARCA_DE_USO = "nx_calc"');
    expect(fonte).not.toMatch(/localStorage|document\.cookie/);
  });
});
```

Em `tests/tema-funil.test.ts`, trocar:

```ts
const HOME = ["app/page.tsx"];
```

por:

```ts
const HOME = ["app/page.tsx", "components/calculadora.tsx"];
```

Em `tests/tema-funil.test.ts`, dentro de `describe("a home", ...)`, trocar:

```ts
  it("recebe o TemaNexora", () => {
    aplicaTema("app/page.tsx");
  });
```

por:

```ts
  it("recebe o TemaNexora", () => {
    aplicaTema("app/page.tsx");
  });

  it("a calculadora usa só o tema do funil", () => {
    expect(achadosDoTemaAntigo("components/calculadora.tsx")).toEqual([]);
  });

  it("o hero leva à calculadora, e a calculadora está na home", () => {
    const home = leia("app/page.tsx");
    expect(home).toMatch(/href="#calculadora"[\s\S]{0,300}Calcular quanto estou perdendo/);
    expect(home).toMatch(/import\s*\{\s*Calculadora\s*\}\s*from\s*["']@\/components\/calculadora["']/);
    expect(home).toContain("<Calculadora />");
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm -C 'C:\Users\eli\Downloads\Documents\saas-platform\apps\recepcionista' exec vitest run tests/calculadora.test.ts tests/tema-funil.test.ts`
Expected: FAIL — ENOENT em `components/calculadora.tsx` (guardas do componente, tema da calculadora e a trava de imports da fronteira) e o hero ainda sem `#calculadora`.

- [ ] **Step 3: Criar o componente**

Criar `components/calculadora.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { registrar } from "@/components/funil";
import {
  CICLO_DA_CALCULADORA,
  EXEMPLO,
  FATIAS,
  MAX_CLIENTES,
  MAX_TICKET_REAIS,
  contaDaCalculadora,
  lerInteiro,
  linkDoDiagnostico,
  type Fatia,
} from "@/lib/recuperacao/calculadora";
import { FAIXA_EM_TEXTO, JANELA_DIAS } from "@/lib/recuperacao/estimativa";

/**
 * A CALCULADORA DA HOME — a conta que o visitante faz com os números dele.
 *
 * Veio da Nexora antiga, com duas trocas: a conta é a do diagnóstico
 * (lib/recuperacao/estimativa.ts), para a home nunca prometer um valor que o
 * diagnóstico desmente; e o ticket segue para o diagnóstico pela URL, em vez de
 * ficar guardado no navegador.
 *
 * Medição: dois eventos, só o nome. Nenhum número digitado sai daqui.
 */

const MARCA_DE_USO = "nx_calc";

const reais = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const CAMPO =
  "mt-2 w-full rounded-lg border border-nx-border bg-nx-surface-2 px-4 py-3 text-2xl font-bold text-nx-primary outline-none transition-colors placeholder:text-nx-muted focus:border-nx-gold/60 focus:ring-2 focus:ring-nx-gold/15";

const plural = (n: number, palavra: string) => `${palavra}${n === 1 ? "" : "s"}`;

export function Calculadora() {
  const [clientes, setClientes] = useState(EXEMPLO.clientes);
  const [ticketReais, setTicketReais] = useState(EXEMPLO.ticketReais);
  const [fatia, setFatia] = useState<Fatia>(EXEMPLO.fatia);
  const [criativo, setCriativo] = useState<string | null>(null);
  const jaUsou = useRef(false);
  const jaClicou = useRef(false);

  // O criativo do anúncio vem da URL da home. Lido depois de montar: no servidor
  // não existe window, e o link sem ele continua funcionando.
  useEffect(() => {
    setCriativo(new URLSearchParams(window.location.search).get("c"));
  }, []);

  const conta = useMemo(
    () => contaDaCalculadora({ clientes, ticketReais, fatia }),
    [clientes, ticketReais, fatia],
  );

  /** Uma vez por sessão da aba; sem armazenamento, uma vez por visita à página. */
  function marcarUso() {
    if (jaUsou.current) return;
    jaUsou.current = true;
    try {
      if (window.sessionStorage.getItem(MARCA_DE_USO)) return;
      window.sessionStorage.setItem(MARCA_DE_USO, "1");
    } catch {
      // Armazenamento bloqueado: conta por visita, o melhor possível sem ele.
    }
    registrar("usou_calculadora");
  }

  function aoIrParaODiagnostico() {
    if (jaClicou.current) return;
    jaClicou.current = true;
    registrar("clicou_calculadora");
  }

  return (
    <div className="rounded-2xl border border-nx-gold/30 bg-nx-surface p-6 shadow-nx-panel sm:p-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <label htmlFor="calc-clientes" className="block text-sm font-medium text-nx-secondary">
              Quantos clientes já passaram pelo seu negócio?
            </label>
            <input
              id="calc-clientes"
              inputMode="numeric"
              value={clientes === 0 ? "" : String(clientes)}
              onChange={(e) => {
                setClientes(lerInteiro(e.target.value, MAX_CLIENTES));
                marcarUso();
              }}
              placeholder={String(EXEMPLO.clientes)}
              className={CAMPO}
            />
          </div>

          <div>
            <label htmlFor="calc-ticket" className="block text-sm font-medium text-nx-secondary">
              Quanto um cliente gasta, em média, por atendimento? (R$)
            </label>
            <input
              id="calc-ticket"
              inputMode="numeric"
              value={ticketReais === 0 ? "" : String(ticketReais)}
              onChange={(e) => {
                setTicketReais(lerInteiro(e.target.value, MAX_TICKET_REAIS));
                marcarUso();
              }}
              placeholder={String(EXEMPLO.ticketReais)}
              className={CAMPO}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-nx-secondary">
              Quanto da sua base você acha que está parada?
            </p>
            <div className="mt-2 flex gap-2">
              {FATIAS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={fatia === f}
                  onClick={() => {
                    setFatia(f);
                    marcarUso();
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-all active:scale-[0.98] ${
                    fatia === f
                      ? "border-nx-gold/50 bg-nx-gold/15 text-nx-gold"
                      : "border-nx-border bg-nx-surface-2 text-nx-secondary hover:bg-nx-surface-3"
                  }`}
                >
                  {Math.round(f * 100)}%
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-nx-muted">
              Não sabe? Comece com {Math.round(EXEMPLO.fatia * 100)}% e ajuste. O diagnóstico com a sua
              lista mostra o número de verdade.
            </p>
            <p className="mt-3 text-xs text-nx-muted">
              Os números já preenchidos são um exemplo. Troque pelos seus.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center rounded-xl border border-nx-border bg-nx-bg/60 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-nx-error">
            Parado na sua base agora
          </p>
          <p className="mt-2 text-4xl font-bold leading-none tracking-tight">
            {conta.parados.toLocaleString("pt-BR")} {plural(conta.parados, "cliente")}{" "}
            {plural(conta.parados, "parado")}
          </p>
          <p className="mt-2 text-sm text-nx-muted">
            {reais(conta.umaVisitaCents)} é uma visita de cada um.
          </p>

          <div className="mt-6 border-t border-nx-border pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-nx-success">
              Em {JANELA_DIAS} dias, voltando no ritmo
            </p>
            <p className="mt-1 text-3xl font-bold text-nx-success">
              {reais(conta.faixa.min)} a {reais(conta.faixa.max)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-nx-muted">
              {FAIXA_EM_TEXTO} de retorno — a mesma faixa que o diagnóstico usa na sua lista.
              Considera {conta.visitas} {plural(conta.visitas, "visita")} de quem volta a cada{" "}
              {CICLO_DA_CALCULADORA} dias.
            </p>
          </div>

          {conta.abaixoDoCorte && (
            <p className="mt-5 rounded-lg border border-nx-warning/25 bg-nx-warning-muted p-3 text-sm leading-relaxed text-nx-primary">
              Com esses números, a Nexora provavelmente não compensa para você agora. O diagnóstico
              confirma com a sua lista, de graça.
            </p>
          )}

          <Link
            href={linkDoDiagnostico({ ticketReais, criativo })}
            onClick={aoIrParaODiagnostico}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-nx-gold px-5 py-3.5 font-semibold text-nx-bg shadow-nx-glow-sm transition-all hover:bg-nx-gold/90 active:scale-[0.98]"
          >
            Ver quais clientes são esses <span aria-hidden="true">→</span>
          </Link>
          <p className="mt-2 text-center text-xs text-nx-muted">
            Grátis. Sem cartão. Você vê a lista antes de decidir qualquer coisa.
          </p>
        </div>
      </div>

      <p className="mt-6 border-t border-nx-border pt-4 text-center text-xs leading-relaxed text-nx-muted">
        A conta à vista:{" "}
        <strong className="text-nx-secondary">
          {conta.parados.toLocaleString("pt-BR")} {plural(conta.parados, "cliente")} ×{" "}
          {reais(ticketReais * 100)} × {conta.visitas} {plural(conta.visitas, "visita")}
        </strong>{" "}
        = {reais(conta.potencialCents)}. Campanhas de recuperação costumam trazer de volta{" "}
        {FAIXA_EM_TEXTO} disso em {JANELA_DIAS} dias.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: A home recebe a calculadora**

Em `app/page.tsx`, trocar:

```tsx
import { TemaNexora } from "@/components/tema-nexora";
```

por:

```tsx
import { Calculadora } from "@/components/calculadora";
import { TemaNexora } from "@/components/tema-nexora";
```

Trocar:

```tsx
              <a
                href="#como-funciona"
                className="rounded-lg border border-nx-border px-6 py-4 text-base font-medium transition-colors hover:bg-nx-surface"
              >
                Ver como funciona
              </a>
```

por:

```tsx
              <a
                href="#calculadora"
                className="rounded-lg border border-nx-border px-6 py-4 text-base font-medium transition-colors hover:bg-nx-surface"
              >
                Calcular quanto estou perdendo
              </a>
```

Trocar:

```tsx
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
```

por:

```tsx
        {/* A CONTA — vem antes da lista de propósito: quanto mais cedo o visitante
            põe os números dele, mais o problema vira problema DELE. */}
        <section id="calculadora" className="scroll-mt-20 px-6 pb-20 pt-4">
          <div className="mx-auto max-w-4xl">
            <p className="text-center text-[11px] font-semibold uppercase tracking-widest text-nx-gold">
              A conta que ninguém faz
            </p>
            <h2 className="mt-3 text-center text-3xl font-bold leading-tight sm:text-4xl">
              Quanto dinheiro está parado na sua base?
            </h2>
            <p className="mx-auto mb-10 mt-4 max-w-xl text-center text-nx-muted">
              Três números seus. A conta aparece na hora, com a fórmula à vista.
            </p>
            <Calculadora />
          </div>
        </section>
```

- [ ] **Step 5: Rodar e ver passar — a calculadora, o tema e as promessas da home**

Run: `pnpm -C 'C:\Users\eli\Downloads\Documents\saas-platform\apps\recepcionista' exec vitest run tests/calculadora.test.ts tests/tema-funil.test.ts tests/promessas-da-landing.test.ts tests/formas-pagamento.test.ts`
Expected: PASS em todos.

- [ ] **Step 6: Commit**

```powershell
git -C 'C:\Users\eli\Downloads\Documents\saas-platform' add -- apps/recepcionista/components/calculadora.tsx apps/recepcionista/app/page.tsx apps/recepcionista/tests/calculadora.test.ts apps/recepcionista/tests/tema-funil.test.ts
git -C 'C:\Users\eli\Downloads\Documents\saas-platform' commit -m @'
funil: a calculadora na home

O bloco "A conta que ninguem faz" vira a calculadora, com a formula do
diagnostico, a conta a vista e o aviso do corte honesto; o hero volta a ter
"Calcular quanto estou perdendo". Nenhum numero de regra escrito a mao e
nada digitado guardado no navegador.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JDpp1rGVVXHuqD6VsRFBse
'@
```

---

### Task 5: Conferência

**Files:** nenhum arquivo de produção, salvo correção do que a conferência encontrar (com teste antes).

- [ ] **Step 1: Suíte, tipos e build — com o `next dev` desligado**

Run: `pnpm -C 'C:\Users\eli\Downloads\Documents\saas-platform\apps\recepcionista' test`
Expected: `prisma generate` concluído e todos os arquivos de teste passando (eram 44 arquivos e 649 testes antes; agora 46 arquivos).

Run: `pnpm -C 'C:\Users\eli\Downloads\Documents\saas-platform\apps\recepcionista' exec tsc --noEmit`
Expected: sem erros.

Run: `pnpm -C 'C:\Users\eli\Downloads\Documents\saas-platform\apps\recepcionista' build`
Expected: build conclui; `/` continua estática.

- [ ] **Step 2: Subir o servidor de conferência**

Run (background): `$env:DATABASE_URL='postgresql://verificacao-visual@127.0.0.1:1/nada'; $env:FOLLOWUP_INTERVAL_MINUTES='30000'; pnpm -C 'C:\Users\eli\Downloads\Documents\saas-platform\apps\recepcionista' exec next dev -p 3002`

Esperar a porta: `$limite=(Get-Date).AddSeconds(90); while ((Get-Date) -lt $limite -and -not (Get-NetTCPConnection -LocalPort 3002 -State Listen -ErrorAction SilentlyContinue)) { Start-Sleep -Seconds 2 }`
Expected: log com `[follow-up] worker ativo (a cada 30000 min)`.

- [ ] **Step 3: Medir a calculadora em 390 px**

Playwright: `browser_resize` 390×844 e `browser_navigate` para `http://localhost:3002/`. Depois `browser_evaluate`:

```js
() => {
  sessionStorage.removeItem('nx_calc');
  window.__eventos = [];
  const original = window.fetch;
  window.fetch = (url, opcoes) => {
    if (String(url).includes('/api/funil')) window.__eventos.push(JSON.parse(opcoes.body).nome);
    return original(url, opcoes);
  };
  // O formato de moeda usa espaço inseparável entre "R$" e o número: normalizar antes de comparar.
  const texto = () => document.querySelector('#calculadora').innerText.replace(/\s+/g, ' ');
  return {
    semRolagemLateral: document.documentElement.scrollWidth <= window.innerWidth,
    exemplo: texto().includes('120 clientes parados') && texto().includes('R$ 8.100 a R$ 13.500'),
    link: document.querySelector('#calculadora a[href^="/diagnostico"]').getAttribute('href'),
    heroLevaACalculadora: !!document.querySelector('a[href="#calculadora"]'),
    eventosAoCarregar: window.__eventos.length,
  };
}
```

Expected: `semRolagemLateral: true`, `exemplo: true`, `link: "/diagnostico?ticket=150"`, `heroLevaACalculadora: true`, `eventosAoCarregar: 0`.

- [ ] **Step 4: Mexer nos números e conferir os eventos**

`browser_evaluate`:

```js
() => {
  const definir = (el, valor) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  definir(document.querySelector('#calc-clientes'), '1000');
  definir(document.querySelector('#calc-ticket'), '80');
  const texto = () => document.querySelector('#calculadora').innerText.replace(/\s+/g, ' ');
  return new Promise((pronto) => setTimeout(() => pronto({
    texto: texto().includes('300 clientes parados'),
    faixa: texto().includes('R$ 10.800 a R$ 18.000'),
    link: document.querySelector('#calculadora a[href^="/diagnostico"]').getAttribute('href'),
    eventos: [...window.__eventos],
    marca: sessionStorage.getItem('nx_calc'),
  }), 300));
}
```

Expected: 1.000 × 30% = 300 parados; 300 × R$ 80 × 3 = R$ 72.000 → `faixa: true` (R$ 10.800 a R$ 18.000); `link: "/diagnostico?ticket=80"`; `eventos: ["usou_calculadora"]` (um só, apesar de duas mudanças); `marca: "1"`.

- [ ] **Step 5: Clicar no botão sem sair da página**

`browser_evaluate`:

```js
() => {
  const botao = document.querySelector('#calculadora a[href^="/diagnostico"]');
  botao.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
  botao.click();
  return new Promise((pronto) => setTimeout(() => pronto({ eventos: [...window.__eventos] }), 300));
}
```

Expected: `eventos: ["usou_calculadora", "clicou_calculadora"]`.

- [ ] **Step 6: Corte honesto e desktop**

`browser_evaluate`:

```js
() => {
  const definir = (el, valor) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  definir(document.querySelector('#calc-clientes'), '50');
  return new Promise((pronto) => setTimeout(() => pronto({
    avisoDoCorte: document.querySelector('#calculadora').innerText.includes('provavelmente não compensa'),
  }), 300));
}
```

Expected: `avisoDoCorte: true` (50 × 30% = 15 parados, abaixo de 25).

Depois `browser_resize` 1280×800, `browser_navigate` para `http://localhost:3002/` e `browser_evaluate`:

```js
() => {
  const texto = document.querySelector('#calculadora').innerText.replace(/\s+/g, ' ');
  return {
    semRolagemLateral: document.documentElement.scrollWidth <= window.innerWidth,
    exemplo: texto.includes('120 clientes parados') && texto.includes('R$ 8.100 a R$ 13.500'),
  };
}
```

Expected: `semRolagemLateral: true`, `exemplo: true`.

- [ ] **Step 7: Desligar o servidor**

Run: `Get-NetTCPConnection -LocalPort 3002 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`

- [ ] **Step 8: Relatório ao dono**

Relatar o que foi medido, o resultado da suíte, do `tsc` e do build. Merge na `main`, push e deploy só com o dono pedindo.
