import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NOME_DA_ESTEIRA } from "@/lib/recuperacao/esteiras";

/**
 * O CONTEÚDO DA LANDING.
 *
 * Hero, aviso da calculadora, demonstração, "o que a Nexora não é" e perguntas.
 * A demonstração é onde a vontade de enfeitar é maior, então ela usa as peças de
 * verdade do produto — a classificação das esteiras, as etiquetas da Onda e a
 * mensagem que o motor escreve — e se declara exemplo.
 */

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));
const semQuebras = (s: string) => s.replace(/\s+/g, " ");

/** Promessas que foram pedidas em algum momento e que o produto não cumpre. */
const PROIBIDAS =
  /disparar mensagens|ia escolhe|banid[oa] em \d|perdem até|garantidos|um clique|1 clique|equipe distribuída|\bRRI\b/i;

describe("o hero", () => {
  // Desde 22/09/2026 o hero é a dor da resposta: o Atendente Virtual entrou na
  // esteira. A frase aprovada da reativação continua na página, na seção dela.
  it("fala da dor de quem responde tarde", () => {
    const home = semQuebras(leia("app/page.tsx"));
    expect(home).toContain("Seu cliente mandou mensagem às 22h.");
    expect(home).toContain("Quem respondeu primeiro ficou com ele.");
  });

  it("a frase aprovada da reativação continua na página", () => {
    const home = semQuebras(leia("app/page.tsx"));
    expect(home).toContain("Seus clientes não avisam que estão indo embora.");
    expect(home).toContain("Eles simplesmente param de voltar.");
  });
});

describe("a demonstração do Atendente Virtual", () => {
  const demo = leia("components/demo-atendente.tsx");

  it("está no hero da home", () => {
    const home = leia("app/page.tsx");
    expect(home).toMatch(/import\s*\{\s*DemoAtendente\s*\}\s*from\s*["']@\/components\/demo-atendente["']/);
    expect(home).toContain("<DemoAtendente />");
  });

  it("usa os mesmos textos do motor, nos três jeitos", () => {
    expect(demo).toContain("textosDoJeito(");
    expect(demo).toContain("conversaDeExemplo(");
    expect(demo).toContain("JEITOS");
  });

  it("se declara exemplo, e as três cenas estão lá", () => {
    expect(demo).toMatch(/Exemplo/);
    expect(semQuebras(demo)).toMatch(/22h/);
    expect(semQuebras(demo)).toMatch(/[Dd]omingo/);
    expect(demo).toContain("MINUTOS_SEM_RESPOSTA");
  });

  it("mostra o \"digitando…\"", () => {
    expect(demo).toContain("digitando…");
  });
});

describe("a calculadora", () => {
  it("avisa que é estimativa", () => {
    expect(semQuebras(leia("components/calculadora.tsx"))).toContain(
      "Estimativa baseada no histórico informado. Não representa receita garantida.",
    );
  });
});

describe("a demonstração do produto", () => {
  it("usa a classificação, as etiquetas e a mensagem de verdade, e se declara exemplo", () => {
    const home = leia("app/page.tsx");
    expect(home).toContain("NOME_DA_ESTEIRA");
    expect(home).toContain("classificar(");
    expect(home).toContain("mensagemDoToque(");
    expect(home).toMatch(/exemplo/i);
  });

  it("as etiquetas são uma só: as mesmas da Onda, do Livro-Caixa e da landing", () => {
    expect(NOME_DA_ESTEIRA).toEqual({
      PRE_ATRASO: "Prestes a sumir",
      ATRASO: "Atrasado",
      RESGATE: "Sumido há muito",
    });
    for (const arquivo of ["app/painel/onda/page.tsx", "app/api/livro-caixa/route.ts"]) {
      const fonte = leia(arquivo);
      expect(fonte, arquivo).toContain("NOME_DA_ESTEIRA");
      expect(fonte, arquivo).not.toContain('"Prestes a sumir"');
    }
  });
});

describe("o que a Nexora não é, e as perguntas", () => {
  it("a home mostra as duas listas compartilhadas, com âncora", () => {
    const home = leia("app/page.tsx");
    expect(home).toContain("O_QUE_A_NEXORA_NAO_E");
    expect(home).toContain('id="nao-e"');
    expect(home).toContain("PERGUNTAS_FREQUENTES");
    expect(home).toContain('id="perguntas"');
  });
});

describe("nenhuma promessa que o produto não cumpre", () => {
  for (const arquivo of [
    "app/page.tsx",
    "components/calculadora.tsx",
    "app/barbearia/page.tsx",
    "components/demo-atendente.tsx",
  ]) {
    it(arquivo, () => {
      expect(leia(arquivo)).not.toMatch(PROIBIDAS);
    });
  }
});
