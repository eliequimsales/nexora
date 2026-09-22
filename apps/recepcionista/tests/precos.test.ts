import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GARANTIA_DIAS, ONDAS_MINIMAS } from "@/lib/billing/garantia";
import { PLANOS } from "@/lib/billing/planos";
import { LINKS_DO_RODAPE } from "@/lib/institucional";
import { PERGUNTAS_DOS_PRECOS, PERGUNTAS_FREQUENTES } from "@/lib/perguntas";

/**
 * A PÁGINA DE PREÇOS.
 *
 * A esteira comercial aprovada pelo fundador (21/09/2026) diz o que esta página
 * pode fazer: mostrar a porta grátis, um preço e o degrau — e nunca cobrar por
 * algo que não existe. Hoje o código vende três jeitos de pagar o MESMO plano;
 * o Completo não tem plano, nem Price, nem limite de profissionais no produto.
 * Enquanto for assim, ele aparece como destino, jamais como compra.
 */

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));
const semQuebras = (s: string) => s.replace(/\s+/g, " ");
const pagina = () => semQuebras(leia("app/precos/page.tsx"));

/** Promessas que foram pedidas em algum momento e que o produto não cumpre. */
const PROIBIDAS =
  /disparar mensagens|ia escolhe|banid[oa] em \d|perdem até|garantidos|um clique|1 clique|equipe distribuída|\bRRI\b/i;
const ZERO_RISCO =
  /zero risco de banimento|risco zero de banimento|sem risco de (ser )?banid|não queima (o |seu )?chip/i;

describe("a página de preços", () => {
  it("existe, é do funil e tem o rodapé de sempre", () => {
    expect(existsSync(join(RAIZ, "app/precos/page.tsx"))).toBe(true);
    expect(pagina()).toMatch(/<TemaNexora>/);
    expect(pagina()).toContain("<RodapeFunil");
  });

  it("a porta é grátis: a primeira Onda vem antes do primeiro real", () => {
    const p = pagina();
    expect(p).toContain("primeira Onda");
    expect(p).toContain("TAMANHO_DA_ONDA");
    expect(p).toContain("DIAS_DA_PRIMEIRA_ONDA");
    expect(p.toLowerCase()).not.toContain("mês grátis");
    expect(p.toLowerCase()).not.toContain("teste de 7 dias");
  });

  it("os jeitos de pagar são exatamente os que o checkout aceita", () => {
    const p = pagina();
    expect(Object.keys(PLANOS)).toEqual(["mensal_cartao", "pix_30_dias", "anual"]);
    expect(p).toContain("PRECO_MENSAL_CENTS");
    expect(p).toContain("PRECO_ANUAL_CENTS");
    expect(p).toContain("PLANOS.pix_30_dias");
    // A Stripe no Brasil só faz Pix avulso: a mensal é no cartão.
    expect(p).toMatch(/sem renovação automática/);
  });

  it("nenhum preço escrito à mão — todos saem das constantes", () => {
    const p = pagina();
    for (const literal of ["R$ 97", "R$ 970", "R$ 197", "97,00", "970,00", "197,00"]) {
      expect(p, literal).not.toContain(literal);
    }
  });

  it("a garantia sai das constantes da garantia", () => {
    const p = pagina();
    expect(GARANTIA_DIAS).toBe(30);
    expect(ONDAS_MINIMAS).toBe(3);
    expect(p).toContain("Garantia Dinheiro Recuperado");
    expect(p).toContain("GARANTIA_DIAS");
    expect(p).toContain("ONDAS_MINIMAS");
  });

  // A implantação é uma chamada com hora de gente: sem Price na Stripe ela não
  // entra no checkout, e a página não pode anunciá-la.
  it("a implantação só aparece quando o Price existe, com as vagas da semana", () => {
    const p = pagina();
    expect(p).toContain("precoDaImplantacao(");
    expect(p).toContain("PRECO_IMPLANTACAO_CENTS");
    expect(p).toContain("VAGAS_POR_SEMANA");
    expect(p).toContain("noStore()");
  });

  it("o Completo é destino, não compra", () => {
    const p = pagina();
    const inicio = p.indexOf("Nexora Completo");
    expect(inicio, "a página fala do Completo").toBeGreaterThan(-1);
    expect(p).toContain("ainda não está à venda");
    const bloco = p.slice(inicio, inicio + 1400);
    expect(bloco).not.toMatch(/CtaLink|href="\/cadastro"|Assinar|Contratar/);
  });

  it("diz o que nunca vai ser cobrado", () => {
    const p = pagina().toLowerCase();
    for (const nunca of ["por mensagem", "por cliente", "porcentagem"]) {
      expect(p, nunca).toContain(nunca);
    }
    // A agenda entra no preço: é o combustível da recuperação, não upsell.
    expect(p).toContain("agenda");
  });

  it("nenhuma promessa que o produto não cumpre", () => {
    const p = pagina();
    expect(p).not.toMatch(PROIBIDAS);
    expect(p).not.toMatch(ZERO_RISCO);
  });

  it("as perguntas são as compartilhadas, num recorte de quatro", () => {
    expect(pagina()).toContain("PERGUNTAS_DOS_PRECOS");
    expect(PERGUNTAS_DOS_PRECOS).toHaveLength(4);
    for (const p of PERGUNTAS_DOS_PRECOS) expect(PERGUNTAS_FREQUENTES).toContain(p);
  });
});

describe("quem procura, acha", () => {
  it("o rodapé de todas as páginas leva a /precos", () => {
    expect(LINKS_DO_RODAPE.map((l) => l.href)).toContain("/precos");
  });

  // Na entrada, a oferta é uma só; a tabela fica para quem for procurar.
  it("a home leva à página de preços pela seção da oferta, não pelo topo", () => {
    const home = leia("app/page.tsx");
    expect(home).toContain('href="/precos"');
    expect(home.indexOf('href="/precos"')).toBeGreaterThan(home.indexOf('id="preco"'));
  });
});
