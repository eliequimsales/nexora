import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  implantacaoDaSessao,
  implantacaoNoCheckout,
  inicioDaSemana,
  linkDoWhatsAppDeSuporte,
  MINUTOS_DA_CHAMADA,
  PRAZO_DA_IMPLANTACAO_DIAS,
  VAGAS_POR_SEMANA,
} from "@/lib/billing/implantacao";
import { parametrosDoCheckout } from "@/lib/billing/planos";
import { emReais, PRECO_IMPLANTACAO_CENTS } from "@/lib/billing/preco";
import { TERMOS } from "@/lib/legal/termos";

/**
 * A IMPLANTAÇÃO: item opcional no pagamento, R$ 97 uma vez, cinco por semana.
 *
 * Ela só aparece quando pode ser cumprida: com o Price configurado, para quem
 * nunca comprou, com vaga na semana e numa compra que cobra de verdade.
 */

describe("inicioDaSemana — segunda 0h em Brasília", () => {
  it("numa quarta, volta para a segunda", () => {
    expect(inicioDaSemana(new Date("2026-09-23T18:00:00.000Z"))).toEqual(
      new Date("2026-09-21T03:00:00.000Z"),
    );
  });

  it("domingo 23h em Brasília ainda é a semana que começou na segunda anterior", () => {
    expect(inicioDaSemana(new Date("2026-09-28T02:00:00.000Z"))).toEqual(
      new Date("2026-09-21T03:00:00.000Z"),
    );
  });

  it("segunda 0h em ponto já é a semana nova", () => {
    expect(inicioDaSemana(new Date("2026-09-28T03:00:00.000Z"))).toEqual(
      new Date("2026-09-28T03:00:00.000Z"),
    );
  });
});

describe("implantacaoNoCheckout", () => {
  const base = { precoId: "price_impl", jaComprou: false, vendidasNaSemana: 0, entraEmTeste: false };

  it("com tudo certo, oferece o Price", () => {
    expect(implantacaoNoCheckout(base)).toBe("price_impl");
  });

  it("sem a variável, a implantação não existe", () => {
    expect(implantacaoNoCheckout({ ...base, precoId: null })).toBeNull();
  });

  it("é uma por negócio", () => {
    expect(implantacaoNoCheckout({ ...base, jaComprou: true })).toBeNull();
  });

  it(`são ${VAGAS_POR_SEMANA} vagas por semana`, () => {
    expect(VAGAS_POR_SEMANA).toBe(5);
    expect(implantacaoNoCheckout({ ...base, vendidasNaSemana: VAGAS_POR_SEMANA - 1 })).toBe(
      "price_impl",
    );
    expect(implantacaoNoCheckout({ ...base, vendidasNaSemana: VAGAS_POR_SEMANA })).toBeNull();
  });

  // Em teste a Stripe não pede cartão: não haveria como cobrar a implantação.
  it("assinatura entrando em teste não leva", () => {
    expect(implantacaoNoCheckout({ ...base, entraEmTeste: true })).toBeNull();
  });
});

describe("implantacaoDaSessao", () => {
  const itens = [
    { price: { id: "price_pro" }, amount_total: 9_700 },
    { price: { id: "price_impl" }, amount_total: 9_700 },
  ];

  it("acha o item pelo Price e devolve o valor cobrado", () => {
    expect(implantacaoDaSessao(itens, "price_impl")).toBe(9_700);
  });

  it("sessão sem o item, ou sem a variável, não tem implantação", () => {
    expect(implantacaoDaSessao(itens.slice(0, 1), "price_impl")).toBeNull();
    expect(implantacaoDaSessao(itens, null)).toBeNull();
  });
});

describe("linkDoWhatsAppDeSuporte", () => {
  it("monta o link com a mensagem pronta", () => {
    expect(
      linkDoWhatsAppDeSuporte({ NEXT_PUBLIC_WHATSAPP_SUPORTE: "55 (11) 98888-7777" }, "Oi, tudo bem?"),
    ).toBe("https://wa.me/5511988887777?text=Oi%2C%20tudo%20bem%3F");
  });

  it("aceita o link direto no lugar do número", () => {
    expect(
      linkDoWhatsAppDeSuporte({ NEXT_PUBLIC_WHATSAPP_SUPORTE: "https://wa.me/5511988887777" }, "Oi"),
    ).toBe("https://wa.me/5511988887777?text=Oi");
  });

  it("sem número válido, não inventa link", () => {
    expect(linkDoWhatsAppDeSuporte({}, "Oi")).toBeNull();
    expect(linkDoWhatsAppDeSuporte({ NEXT_PUBLIC_WHATSAPP_SUPORTE: "1234" }, "Oi")).toBeNull();
  });
});

describe("a implantação na sessão da Stripe", () => {
  const comum = {
    customerId: "cus_1",
    companyId: "c1",
    appUrl: "https://app.exemplo",
    fimDoTrial: null,
    garantia: true,
    env: {
      STRIPE_PRICE_PRO: "price_pro",
      STRIPE_PRICE_PASSE_30: "price_30",
      STRIPE_PRICE_ANUAL: "price_ano",
    },
  };

  it("entra como item opcional na assinatura e no pagamento avulso", () => {
    for (const plano of ["mensal_cartao", "pix_30_dias", "anual"] as const) {
      const p = parametrosDoCheckout({ ...comum, plano, implantacao: "price_impl" });
      expect(p.optional_items, plano).toEqual([{ price: "price_impl", quantity: 1 }]);
    }
  });

  it("sem implantação decidida pela rota, a tela da Stripe não mostra nada a mais", () => {
    expect(parametrosDoCheckout({ ...comum, plano: "mensal_cartao" }).optional_items).toBeUndefined();
    expect(
      parametrosDoCheckout({ ...comum, plano: "anual", implantacao: null }).optional_items,
    ).toBeUndefined();
  });
});

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));
const termos = TERMOS.secoes
  .flatMap((s) => [s.titulo, ...s.paragrafos, ...(s.itens ?? [])])
  .join("\n");

describe("as pontas da implantação", () => {
  it("o preço é R$ 97, uma vez", () => {
    expect(PRECO_IMPLANTACAO_CENTS).toBe(9_700);
  });

  it("a rota do checkout decide a implantação e a passa para a sessão", () => {
    const rota = leia("app/api/billing/checkout/route.ts");
    expect(rota).toContain("implantacaoParaOCheckout(");
    expect(rota).toMatch(/parametrosDoCheckout\(\{[\s\S]*implantacao[\s\S]*\}\)/);
  });

  it("a convergência registra a implantação depois de gravar o acesso", () => {
    expect(leia("lib/billing/converger.ts")).toMatch(
      /aplicarCompra\([\s\S]{0,200}registrarImplantacao\(/,
    );
  });

  it("o registro lê os itens pagos e é um por sessão", () => {
    const reg = leia("lib/billing/implantacao-da-conta.ts");
    expect(reg).toContain("listLineItems(");
    expect(reg).toContain("P2002");
    expect(reg).toContain("implantacao-paga-duas-vezes");
  });

  it("Minha conta mostra o botão de marcar pelo WhatsApp", () => {
    expect(leia("app/painel/assinatura/page.tsx")).toContain("linkDoWhatsAppDeSuporte(");
  });

  it("os Termos descrevem a implantação com os números do código", () => {
    expect(termos).toContain(emReais(PRECO_IMPLANTACAO_CENTS));
    expect(termos).toContain(`${MINUTOS_DA_CHAMADA} minutos`);
    expect(termos).toContain(`${PRAZO_DA_IMPLANTACAO_DIAS} dias`);
    expect(termos.toLowerCase()).toContain("implantação, opcional");
  });
});
