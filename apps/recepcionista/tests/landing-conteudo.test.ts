import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { O_QUE_A_NEXORA_NAO_E, PERGUNTAS_DA_HOME, PERGUNTAS_FREQUENTES } from "@/lib/perguntas";
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
  // Desde 27/09/2026, com a validação do tráfego pago, o Atendente 24h é o produto
  // principal da Nexora, e a recuperação de clientes inativos é o plano Completo.
  it("abre com o Atendente 24h e o aprendizado com a empresa", () => {
    const home = semQuebras(leia("app/page.tsx"));
    expect(home).toContain("Nunca mais perca clientes fora do horário");
    expect(home).toContain("de madrugada.");
    expect(home).toContain("O Atendente Inteligente que aprende");
    expect(home).toContain("Ativar meu Atendente 24h grátis");
  });

  it("a landing page foca 100% no Atendente 24h sem distrair com recuperação externa", () => {
    const home = semQuebras(leia("app/page.tsx"));
    expect(home).not.toContain("Seus clientes não avisam que estão indo embora.");
    expect(home).not.toContain("Recuperar meus clientes grátis");
  });

  it("hierarquia do produto: foco limpo e sequencial no Atendente", () => {
    const home = leia("app/page.tsx");
    const marcos = ["<h1", 'id="atendente"'];
    const posicoes = marcos.map((m) => home.indexOf(m));
    marcos.forEach((m, i) => expect(posicoes[i], m).toBeGreaterThan(-1));
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
  });
});

describe("a demonstração do Atendente Virtual", () => {
  const demo = leia("components/demo-atendente.tsx");

  it("está na seção do Atendente", () => {
    const home = leia("app/page.tsx");
    expect(home).toMatch(/import\s*\{\s*DemoAtendente\s*\}\s*from\s*["']@\/components\/demo-atendente["']/);
    const onde = home.indexOf("<DemoAtendente />");
    expect(onde).toBeGreaterThan(home.indexOf('id="atendente"'));
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

describe("a demonstração da Onda", () => {
  it("usa a classificação, as etiquetas e a mensagem de verdade no painel", () => {
    const onda = leia("app/painel/onda/page.tsx");
    expect(onda).toContain("NOME_DA_ESTEIRA");
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
  it("as listas compartilhadas continuam mantidas e sincronizadas", () => {
    expect(PERGUNTAS_DA_HOME).toHaveLength(4);
    for (const p of PERGUNTAS_DA_HOME) expect(PERGUNTAS_FREQUENTES).toContain(p);
    expect(O_QUE_A_NEXORA_NAO_E).toHaveLength(3);
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

  it("e os termos mantêm o aviso do QR Code", () => {
    expect(semQuebras(leia("lib/legal/termos.ts"))).toMatch(/não é a oficial do WhatsApp/);
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

describe("dados estruturados GeoSchema (Schema.org / Google Search Console)", () => {
  const home = leia("app/page.tsx");

  it("Product possui aggregateRating e reviews válidos para Snippets de Produto", () => {
    expect(home).toContain('"@type": "Product"');
    // Verifica que Product tem aggregateRating e review
    const productIdx = home.indexOf('"@type": "Product"');
    const productChunk = home.slice(productIdx, productIdx + 2500);
    expect(productChunk).toContain('"@type": "AggregateRating"');
    expect(productChunk).toContain('"@type": "Review"');
    expect(productChunk).toContain('ratingValue: "4.9"');
    expect(productChunk).toContain('priceValidUntil: "2027-12-31"');
  });

  it("não declara VideoObject incompleto enquanto a demonstração for o simulador web", () => {
    expect(home).not.toContain('"@type": "VideoObject"');
  });
});

