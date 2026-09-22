import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PERGUNTAS_DA_HOME, PERGUNTAS_FREQUENTES } from "@/lib/perguntas";
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
  // Desde o redesenho de conversão de 22/09/2026, o hero é a recuperação — o
  // dinheiro que já está na lista do dono. O Atendente Virtual é a defesa, na
  // seção dele. (Entre a manhã e a tarde desse dia, o hero foi o Atendente.)
  it("abre com o dinheiro parado na lista de clientes", () => {
    const home = semQuebras(leia("app/page.tsx"));
    expect(home).toContain("Seus clientes não sumiram porque quiseram.");
    expect(home).toContain("Eles só esqueceram de voltar.");
    expect(home).toContain("Recuperar meus clientes grátis");
  });

  it("a frase aprovada da reativação continua na página", () => {
    const home = semQuebras(leia("app/page.tsx"));
    expect(home).toContain("Seus clientes não avisam que estão indo embora.");
    expect(home).toContain("Eles simplesmente param de voltar.");
  });

  it("ataque antes da defesa: a conta e a recuperação vêm antes do Atendente", () => {
    const home = leia("app/page.tsx");
    const marcos = ["<h1", 'id="calculadora"', 'id="como-funciona"', 'id="atendente"', 'id="nao-e"', 'id="preco"', 'id="perguntas"'];
    const posicoes = marcos.map((m) => home.indexOf(m));
    marcos.forEach((m, i) => expect(posicoes[i], m).toBeGreaterThan(-1));
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
  });
});

describe("a demonstração do Atendente Virtual", () => {
  const demo = leia("components/demo-atendente.tsx");

  it("está na seção do Atendente, depois da recuperação", () => {
    const home = leia("app/page.tsx");
    expect(home).toMatch(/import\s*\{\s*DemoAtendente\s*\}\s*from\s*["']@\/components\/demo-atendente["']/);
    const onde = home.indexOf("<DemoAtendente />");
    expect(onde).toBeGreaterThan(home.indexOf('id="atendente"'));
    expect(onde).toBeGreaterThan(home.indexOf('id="como-funciona"'));
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

  // O botão convida a trazer de volta, mas leva ao diagnóstico: a frase embaixo
  // diz o próximo passo de verdade.
  it("o convite de trazer de volta diz que primeiro você vê quem são", () => {
    const calculadora = semQuebras(leia("components/calculadora.tsx"));
    expect(calculadora).toContain("Trazer esses clientes de volta agora");
    expect(calculadora).toContain("Primeiro você vê quem são");
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
  it("a home mostra as listas compartilhadas — das perguntas, um recorte de quatro — com âncora", () => {
    const home = leia("app/page.tsx");
    expect(home).toContain("O_QUE_A_NEXORA_NAO_E");
    expect(home).toContain('id="nao-e"');
    expect(home).toContain("PERGUNTAS_DA_HOME");
    expect(home).toContain('id="perguntas"');
    expect(PERGUNTAS_DA_HOME).toHaveLength(4);
    // O mesmo objeto, não uma cópia: a resposta da home é a da página de ramo.
    for (const p of PERGUNTAS_DA_HOME) expect(PERGUNTAS_FREQUENTES).toContain(p);
  });
});

/**
 * O pedido do redesenho de 22/09/2026 trazia "zero risco de banimento" e "Não,
 * seguimos as diretrizes". A conexão por QR Code não é a oficial e o WhatsApp
 * restringe número: a página diz o que a Nexora faz para diminuir o risco, e
 * nunca que ele não existe (Constituição, VI — verdade acima de marketing).
 */
describe("o risco do número é dito como é", () => {
  const ZERO_RISCO =
    /zero risco de banimento|risco zero de banimento|sem risco de (ser )?banid|não queima (o |seu )?chip|nunca (vai ser|será|é) banid/i;

  for (const arquivo of ["app/page.tsx", "lib/perguntas.ts", "components/demo-atendente.tsx", "components/calculadora.tsx"]) {
    it(`${arquivo} não promete risco zero`, () => {
      expect(leia(arquivo)).not.toMatch(ZERO_RISCO);
    });
  }

  it("e a home mantém o aviso do QR Code", () => {
    expect(semQuebras(leia("app/page.tsx"))).toMatch(/QR Code não é a oficial do WhatsApp/);
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
