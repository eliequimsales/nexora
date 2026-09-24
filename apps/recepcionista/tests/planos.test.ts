import { describe, expect, it } from "vitest";
import type { EstadoConta } from "@/lib/billing/acesso";
import {
  acoesDaConta,
  parametrosDoCheckout,
  planoDisponivel,
  PLANOS,
  PRECO_COMPLETO_ANUAL_CENTS,
  PRECO_COMPLETO_MENSAL_CENTS,
  precoPendenteDoPlano,
  type PlanoId,
} from "@/lib/billing/planos";
import { PRECO_ANUAL_CENTS, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";

/**
 * OS SEIS PLANOS (NEXORA E NEXORA COMPLETO).
 *
 * - Mensal no cartão: assinatura recorrente (STRIPE_PRICE_PRO).
 * - 30 dias no Pix: pagamento avulso (STRIPE_PRICE_PASSE_30).
 * - Anual à vista: pagamento avulso de 12 meses (STRIPE_PRICE_ANUAL).
 * - Completo mensal: assinatura recorrente (STRIPE_PRICE_COMPLETO_MENSAL).
 * - Completo Pix 30 dias: pagamento avulso (STRIPE_PRICE_COMPLETO_PIX).
 * - Completo anual: pagamento avulso de 12 meses (STRIPE_PRICE_COMPLETO_ANUAL).
 */

const ENV = {
  STRIPE_PRICE_PRO: "price_mensal",
  STRIPE_PRICE_PASSE_30: "price_passe",
  STRIPE_PRICE_ANUAL: "price_anual",
  STRIPE_PRICE_COMPLETO_MENSAL: "price_completo_mensal",
  STRIPE_PRICE_COMPLETO_PIX: "price_completo_pix",
  STRIPE_PRICE_COMPLETO_ANUAL: "price_completo_anual",
};

const BASE = {
  customerId: "cus_1",
  companyId: "cmp_1",
  appUrl: "https://www.meunexora.com.br",
  fimDoTrial: null,
  garantia: true,
  env: ENV,
};

const TODOS: PlanoId[] = [
  "mensal_cartao",
  "pix_30_dias",
  "anual",
  "completo_cartao",
  "completo_pix",
  "completo_anual",
];

describe("PLANOS", () => {
  it("são exatamente seis: três de entrada e três completos", () => {
    expect(Object.keys(PLANOS).sort()).toEqual([
      "anual",
      "completo_anual",
      "completo_cartao",
      "completo_pix",
      "mensal_cartao",
      "pix_30_dias",
    ]);
  });

  it("os mensais são assinatura; os outros quatro são pagamentos avulsos com prazo", () => {
    expect(PLANOS.mensal_cartao).toMatchObject({ modo: "subscription", dias: null });
    expect(PLANOS.pix_30_dias).toMatchObject({ modo: "payment", dias: 30 });
    expect(PLANOS.anual).toMatchObject({ modo: "payment", dias: 365 });
    expect(PLANOS.completo_cartao).toMatchObject({ modo: "subscription", dias: null });
    expect(PLANOS.completo_pix).toMatchObject({ modo: "payment", dias: 30 });
    expect(PLANOS.completo_anual).toMatchObject({ modo: "payment", dias: 365 });
  });

  it("os valores vêm das constantes de preço, nunca de número solto", () => {
    expect(PLANOS.mensal_cartao.valorCents).toBe(PRECO_MENSAL_CENTS);
    expect(PLANOS.pix_30_dias.valorCents).toBe(PRECO_MENSAL_CENTS);
    expect(PLANOS.anual.valorCents).toBe(PRECO_ANUAL_CENTS);
    expect(PLANOS.completo_cartao.valorCents).toBe(PRECO_COMPLETO_MENSAL_CENTS);
    expect(PLANOS.completo_pix.valorCents).toBe(PRECO_COMPLETO_MENSAL_CENTS);
    expect(PLANOS.completo_anual.valorCents).toBe(PRECO_COMPLETO_ANUAL_CENTS);
  });

  // A Stripe aceita Pix de R$ 0,50 a R$ 3.000 por transação.
  it("nenhum plano avulso passa do teto de uma transação Pix", () => {
    for (const plano of TODOS) {
      if (PLANOS[plano].modo === "payment") {
        expect(PLANOS[plano].valorCents, plano).toBeLessThanOrEqual(300_000);
      }
    }
  });
});

describe("parametrosDoCheckout", () => {
  it("nunca fixa payment_method_types: as formas de pagamento vêm do Dashboard", () => {
    for (const plano of TODOS) {
      expect(parametrosDoCheckout({ ...BASE, plano }), plano).not.toHaveProperty(
        "payment_method_types",
      );
    }
  });

  it("todo plano leva o tenant e volta para Minha conta com o id da sessão", () => {
    for (const plano of TODOS) {
      const p = parametrosDoCheckout({ ...BASE, plano });
      expect(p.customer, plano).toBe("cus_1");
      expect(p.metadata?.companyId, plano).toBe("cmp_1");
      expect(p.metadata?.plano, plano).toBe(plano);
      expect(p.success_url, plano).toBe(
        "https://www.meunexora.com.br/painel/assinatura?ok=1&session_id={CHECKOUT_SESSION_ID}",
      );
      expect(p.cancel_url, plano).toBe("https://www.meunexora.com.br/painel/assinatura?cancelado=1");
      // O Stripe Tax não cobre o Brasil: o preço já é imposto-incluso.
      expect(p.automatic_tax, plano).toEqual({ enabled: false });
    }
  });

  it("mensal: assinatura com o preço recorrente e sem teste quando não há relógio", () => {
    const p = parametrosDoCheckout({ ...BASE, plano: "mensal_cartao" });
    expect(p.mode).toBe("subscription");
    expect(p.line_items).toEqual([{ price: "price_mensal", quantity: 1 }]);
    expect(p.subscription_data?.metadata?.companyId).toBe("cmp_1");
    expect(p.subscription_data?.trial_end).toBeUndefined();
  });

  it("mensal com teste antigo em andamento: o trial termina no dia do relógio e pausa sem cartão", () => {
    const p = parametrosDoCheckout({ ...BASE, plano: "mensal_cartao", fimDoTrial: 1_900_000_000 });
    expect(p.subscription_data?.trial_end).toBe(1_900_000_000);
    expect(p.subscription_data?.trial_settings?.end_behavior.missing_payment_method).toBe("pause");
  });

  it("30 dias: pagamento avulso com o preço do passe, QR com prazo e os dias no metadata", () => {
    const p = parametrosDoCheckout({ ...BASE, plano: "pix_30_dias" });
    expect(p.mode).toBe("payment");
    expect(p.line_items).toEqual([{ price: "price_passe", quantity: 1 }]);
    expect(p.subscription_data).toBeUndefined();
    expect(p.metadata?.passeDias).toBe("30");
    expect(p.payment_intent_data?.metadata?.companyId).toBe("cmp_1");
    expect(p.payment_intent_data?.metadata?.passeDias).toBe("30");
    const expira = p.payment_method_options?.pix?.expires_after_seconds ?? 0;
    expect(expira).toBeGreaterThanOrEqual(10);
    expect(expira).toBeLessThanOrEqual(1_209_600);
  });

  it("anual: pagamento avulso de 365 dias com o preço anual", () => {
    const p = parametrosDoCheckout({ ...BASE, plano: "anual" });
    expect(p.mode).toBe("payment");
    expect(p.line_items).toEqual([{ price: "price_anual", quantity: 1 }]);
    expect(p.metadata?.passeDias).toBe("365");
  });

  it("pagamento avulso nunca carrega teste grátis", () => {
    for (const plano of ["pix_30_dias", "anual", "completo_pix", "completo_anual"] as const) {
      const p = parametrosDoCheckout({ ...BASE, plano, fimDoTrial: 1_900_000_000 });
      expect(p.subscription_data, plano).toBeUndefined();
    }
  });

  // A garantia vale para a lista que o dono tinha NA COMPRA. O dado viaja com o
  // pagamento para que ninguém precise reconstruir depois o que a tela mostrou.
  it("leva no metadata se a compra tem garantia, em todo objeto que a Stripe devolve", () => {
    const mensal = parametrosDoCheckout({ ...BASE, plano: "mensal_cartao", garantia: false });
    expect(mensal.metadata?.garantia).toBe("nao");
    expect(mensal.subscription_data?.metadata?.garantia).toBe("nao");

    const pix = parametrosDoCheckout({ ...BASE, plano: "pix_30_dias" });
    expect(pix.metadata?.garantia).toBe("sim");
    expect(pix.payment_intent_data?.metadata?.garantia).toBe("sim");
  });
});

describe("precoPendenteDoPlano", () => {
  it("diz o NOME da variável que falta para aquele plano, nunca um valor", () => {
    expect(precoPendenteDoPlano("pix_30_dias", {})).toBe("STRIPE_PRICE_PASSE_30");
    expect(precoPendenteDoPlano("anual", { STRIPE_PRICE_ANUAL: "   " })).toBe("STRIPE_PRICE_ANUAL");
    expect(precoPendenteDoPlano("mensal_cartao", {})).toBe("STRIPE_PRICE_PRO");
    expect(precoPendenteDoPlano("completo_cartao", {})).toBe("STRIPE_PRICE_COMPLETO_MENSAL");
    expect(precoPendenteDoPlano("completo_pix", {})).toBe("STRIPE_PRICE_COMPLETO_PIX");
    expect(precoPendenteDoPlano("completo_anual", {})).toBe("STRIPE_PRICE_COMPLETO_ANUAL");
    expect(precoPendenteDoPlano("mensal_cartao", ENV)).toBeNull();
    expect(precoPendenteDoPlano("completo_cartao", ENV)).toBeNull();
  });
});

/**
 * O QUE A CONTA PODE CONTRATAR AGORA.
 *
 * Seis planos convivendo abrem um jeito novo de errar com o dinheiro dos outros:
 * vender um segundo plano para quem já paga o primeiro. A regra mora numa função
 * pura e vale dos dois lados — a tela só mostra o que a rota aceita.
 */
const ESTADOS: EstadoConta[] = [
  "GRATIS",
  "TRIAL",
  "TRIAL_EXPIRADO",
  "ATIVO",
  "PASSE",
  "TOLERANCIA",
  "CANCELADO_COM_ACESSO",
  "BLOQUEADO",
  "CANCELADO",
];

const STATUS = [null, "active", "trialing", "past_due", "unpaid", "paused", "canceled", "incomplete"];

describe("acoesDaConta", () => {
  it("sem assinatura nenhuma, os seis planos e nada para gerenciar", () => {
    for (const estado of ["GRATIS", "TRIAL", "TRIAL_EXPIRADO"] as const) {
      expect(acoesDaConta({ estado, subscriptionStatus: null }), estado).toEqual({
        portal: null,
        planos: [
          "mensal_cartao",
          "pix_30_dias",
          "anual",
          "completo_cartao",
          "completo_pix",
          "completo_anual",
        ],
      });
    }
  });

  // Vender o Pix para quem já paga no cartão seria cobrar duas vezes pelo mesmo mês.
  it("assinatura cobrando no cartão: só o portal, nenhum plano novo", () => {
    expect(acoesDaConta({ estado: "ATIVO", subscriptionStatus: "active" })).toEqual({
      portal: "Gerenciar assinatura",
      planos: [],
    });
    expect(acoesDaConta({ estado: "TOLERANCIA", subscriptionStatus: "past_due" })).toEqual({
      portal: "Atualizar forma de pagamento",
      planos: [],
    });
    expect(acoesDaConta({ estado: "BLOQUEADO", subscriptionStatus: "unpaid" })).toEqual({
      portal: "Atualizar forma de pagamento",
      planos: [],
    });
  });

  it("teste com a assinatura já criada: cartão pelo portal, e Pix ou anual liberados", () => {
    expect(acoesDaConta({ estado: "TRIAL", subscriptionStatus: "trialing" })).toEqual({
      portal: "Gerenciar assinatura",
      planos: ["pix_30_dias", "anual", "completo_pix", "completo_anual"],
    });
  });

  it("passe valendo: dá para estender no Pix ou no anual, e o mensal espera o passe acabar", () => {
    expect(acoesDaConta({ estado: "PASSE", subscriptionStatus: null })).toEqual({
      portal: null,
      planos: ["pix_30_dias", "anual", "completo_pix", "completo_anual"],
    });
  });

  it("cancelada ou pausada: os seis planos de novo", () => {
    for (const [estado, status] of [
      ["CANCELADO", "canceled"],
      ["CANCELADO_COM_ACESSO", "canceled"],
      ["TRIAL_EXPIRADO", "paused"],
    ] as const) {
      expect(acoesDaConta({ estado, subscriptionStatus: status }).planos, status).toEqual([
        "mensal_cartao",
        "pix_30_dias",
        "anual",
        "completo_cartao",
        "completo_pix",
        "completo_anual",
      ]);
    }
  });
});

describe("planoDisponivel", () => {
  it("libera o que a tela oferece", () => {
    expect(
      planoDisponivel({ plano: "pix_30_dias", estado: "GRATIS", subscriptionStatus: null }),
    ).toEqual({ pode: true });
  });

  it("recusa com o caminho certo quando cobraria duas vezes", () => {
    const r = planoDisponivel({ plano: "pix_30_dias", estado: "ATIVO", subscriptionStatus: "active" });
    expect(r.pode).toBe(false);
    if (r.pode) return;
    expect(r.motivo).toContain("Gerenciar assinatura");
  });

  it("recusa o mensal durante o passe e diz quando ele volta", () => {
    const r = planoDisponivel({ plano: "mensal_cartao", estado: "PASSE", subscriptionStatus: null });
    expect(r.pode).toBe(false);
    if (r.pode) return;
    expect(r.motivo).toContain("acabarem");
  });

  it("a rota aceita exatamente o que a tela mostra, e toda recusa diz o porquê", () => {
    for (const estado of ESTADOS) {
      for (const subscriptionStatus of STATUS) {
        for (const plano of TODOS) {
          const caso = `${plano}/${estado}/${subscriptionStatus}`;
          const naTela = acoesDaConta({ estado, subscriptionStatus }).planos.includes(plano);
          const naRota = planoDisponivel({ plano, estado, subscriptionStatus });
          expect(naRota.pode, caso).toBe(naTela);
          if (!naRota.pode) expect(naRota.motivo.length, caso).toBeGreaterThan(0);
        }
      }
    }
  });
});
