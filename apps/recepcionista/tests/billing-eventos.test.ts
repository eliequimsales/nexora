import { describe, expect, it } from "vitest";
import {
  companyIdDe,
  deveProvisionar,
  EVENTOS_ASSINADOS,
  periodoFimDe,
} from "@/lib/billing/eventos";

describe("periodoFimDe", () => {
  // O campo saiu da raiz do Subscription e vive em items.data[]. Verificado no
  // tarball do stripe@22.6.0: Subscriptions.d.ts só cita o nome em comentário e
  // em parâmetro de list; o campo real está em SubscriptionItems.d.ts:54.
  it("lê de items.data[0], que é onde o campo vive hoje", () => {
    const fim = periodoFimDe({
      items: { data: [{ current_period_end: 1_800_000_000 }] },
    });
    expect(fim?.getTime()).toBe(1_800_000_000_000);
  });

  it("NUNCA lê da raiz do objeto, mesmo que algo plante o campo lá", () => {
    // Blindagem contra regressão: o código antigo do apps/api lia daqui e
    // gerava new Date(NaN) silencioso, fazendo a data de acesso mentir.
    const fim = periodoFimDe({
      current_period_end: 1_600_000_000,
      items: { data: [{ current_period_end: 1_800_000_000 }] },
    } as never);
    expect(fim?.getTime()).toBe(1_800_000_000_000);
  });

  it("sem item, devolve null em vez de Invalid Date", () => {
    expect(periodoFimDe({ items: { data: [] } })).toBeNull();
    expect(periodoFimDe({})).toBeNull();
  });
});

describe("deveProvisionar", () => {
  it("pagamento confirmado provisiona", () => {
    expect(deveProvisionar({ payment_status: "paid" })).toBe(true);
  });

  // Cupom de 100% e trial sem cartão chegam assim. O teste estrito
  // `=== "paid"` deixaria justamente a promoção de "risco zero" sem provisionar,
  // e falharia em silêncio.
  it("no_payment_required provisiona — é o cupom de 100% e o trial sem cartão", () => {
    expect(deveProvisionar({ payment_status: "no_payment_required" })).toBe(true);
  });

  it("unpaid NÃO provisiona — é o boleto ainda não compensado", () => {
    expect(deveProvisionar({ payment_status: "unpaid" })).toBe(false);
  });
});

describe("companyIdDe", () => {
  it("lê o tenant do metadata", () => {
    expect(companyIdDe({ metadata: { companyId: "cmp_1" } })).toBe("cmp_1");
  });

  // A conta Stripe do irmão hospeda também o webhook do apps/api (NestJS), que
  // marca os eventos dele com `orgId`. Um evento daquele produto chegando aqui
  // não é erro — e responder 500 colocaria a Stripe em retry de 3 dias e
  // inundaria o ErrorLog.
  it("devolve null quando o evento é de outro produto da mesma conta", () => {
    expect(companyIdDe({ metadata: { orgId: "org_9" } })).toBeNull();
    expect(companyIdDe({})).toBeNull();
    expect(companyIdDe(null)).toBeNull();
  });
});

describe("EVENTOS_ASSINADOS", () => {
  it("não assina invoice.created", () => {
    // A doc pede para assinar só o necessário. invoice.created ainda atrasa a
    // cobrança da CONTA inteira enquanto qualquer endpoint dela não responde.
    expect(EVENTOS_ASSINADOS).not.toContain("invoice.created");
  });

  it("inclui os que governam status, dinheiro e fim de trial", () => {
    for (const e of [
      "checkout.session.completed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed",
      "customer.subscription.trial_will_end",
    ]) {
      expect(EVENTOS_ASSINADOS).toContain(e);
    }
  });
});
