import type Stripe from "stripe";
import type { EstadoConta } from "./acesso";
import { PRECO_ANUAL_CENTS, PRECO_MENSAL_CENTS } from "./preco";

/**
 * OS TRÊS JEITOS DE PAGAR.
 *
 * - Mensal no cartão: assinatura recorrente.
 * - 30 dias no Pix: pagamento avulso, sem renovação automática. A Stripe no
 *   Brasil só faz Pix avulso — o Pix Automático, que seria o recorrente, não está
 *   disponível para contas brasileiras (documentação conferida em 14/09/2026).
 * - Anual à vista: pagamento avulso de 12 meses.
 *
 * O preço cobrado de verdade é o do Price na Stripe, lido da variável de cada
 * plano. `valorCents` existe para a tela e para o e-mail — e precisa bater com o
 * Price, que é configurado fora do repositório.
 */

export type PlanoId = "mensal_cartao" | "pix_30_dias" | "anual";

export type Plano = {
  modo: "subscription" | "payment";
  variavelDoPreco: "STRIPE_PRICE_PRO" | "STRIPE_PRICE_PASSE_30" | "STRIPE_PRICE_ANUAL";
  /** Dias de acesso de um pagamento avulso. null na assinatura. */
  dias: number | null;
  valorCents: number;
};

export const PLANOS: Record<PlanoId, Plano> = {
  mensal_cartao: {
    modo: "subscription",
    variavelDoPreco: "STRIPE_PRICE_PRO",
    dias: null,
    valorCents: PRECO_MENSAL_CENTS,
  },
  pix_30_dias: {
    modo: "payment",
    variavelDoPreco: "STRIPE_PRICE_PASSE_30",
    dias: 30,
    valorCents: PRECO_MENSAL_CENTS,
  },
  anual: {
    modo: "payment",
    variavelDoPreco: "STRIPE_PRICE_ANUAL",
    dias: 365,
    valorCents: PRECO_ANUAL_CENTS,
  },
};

const IDS = Object.keys(PLANOS) as PlanoId[];

/**
 * O plano pedido pela tela.
 *
 * Sem plano no corpo é o mensal: o botão que já existia manda POST vazio e não
 * pode quebrar. Plano desconhecido é recusado (null) — virar mensal em silêncio
 * cobraria um produto que ninguém escolheu.
 */
export function lerPlano(corpo: unknown): PlanoId | null {
  if (!corpo || typeof corpo !== "object" || !("plano" in corpo)) return "mensal_cartao";
  const plano = (corpo as { plano: unknown }).plano;
  return typeof plano === "string" && (IDS as string[]).includes(plano) ? (plano as PlanoId) : null;
}

/** O NOME da variável de preço que falta para o plano, ou null. Nunca o valor. */
export function precoPendenteDoPlano(
  plano: PlanoId,
  env: Record<string, string | undefined>,
): string | null {
  const variavel = PLANOS[plano].variavelDoPreco;
  return (env[variavel] ?? "").trim() ? null : variavel;
}

/**
 * Por quanto tempo o QR do Pix vale. O Checkout aceita de 10 segundos a 14 dias;
 * 24 horas deixam o dono pagar pelo app do banco no fim do dia sem o QR morrer
 * na mão dele.
 */
const PIX_EXPIRA_EM_SEGUNDOS = 24 * 60 * 60;

export function parametrosDoCheckout(p: {
  plano: PlanoId;
  customerId: string;
  companyId: string;
  appUrl: string;
  /** `trial_end` em segundos Unix, só para conta antiga com teste em andamento. */
  fimDoTrial: number | null;
  env: Record<string, string | undefined>;
}): Stripe.Checkout.SessionCreateParams {
  const plano = PLANOS[p.plano];

  const comum = {
    customer: p.customerId,
    line_items: [{ price: (p.env[plano.variavelDoPreco] ?? "").trim(), quantity: 1 }],
    // O tenant precisa viajar no objeto que os webhooks entregam.
    metadata: {
      companyId: p.companyId,
      plano: p.plano,
      ...(plano.dias ? { passeDias: String(plano.dias) } : {}),
    },
    // O Brasil não é suportado pelo Stripe Tax: o preço já é imposto-incluso e a
    // NFS-e sai fora da Stripe.
    automatic_tax: { enabled: false },
    // `{CHECKOUT_SESSION_ID}` deixa a página de retorno convergir sozinha se o
    // webhook ainda não chegou.
    success_url: `${p.appUrl}/painel/assinatura?ok=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${p.appUrl}/painel/assinatura?cancelado=1`,
  };

  if (plano.modo === "subscription") {
    const assinatura: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: { companyId: p.companyId },
    };
    if (p.fimDoTrial) {
      assinatura.trial_end = p.fimDoTrial;
      // `pause`, nunca `cancel`: pausada, a assinatura sobrevive e é retomada com o
      // mesmo histórico quando o dono põe o cartão.
      assinatura.trial_settings = { end_behavior: { missing_payment_method: "pause" } };
    }
    return {
      ...comum,
      mode: "subscription",
      // Sem cartão enquanto houver teste; sem teste, há valor a cobrar e a Stripe pede.
      payment_method_collection: "if_required",
      subscription_data: assinatura,
    };
  }

  // Pagamento avulso: Pix e cartão aparecem pelo Dashboard (formas dinâmicas).
  return {
    ...comum,
    mode: "payment",
    payment_method_options: { pix: { expires_after_seconds: PIX_EXPIRA_EM_SEGUNDOS } },
    payment_intent_data: {
      metadata: { companyId: p.companyId, passeDias: String(plano.dias) },
    },
  };
}

/** Assinatura que já está cobrando o cartão — ou tentando cobrar. */
const COBRANDO_NO_CARTAO = ["active", "past_due", "unpaid"];

const ORDEM_DA_TELA: PlanoId[] = ["mensal_cartao", "pix_30_dias", "anual"];
const SO_AVULSOS: PlanoId[] = ["pix_30_dias", "anual"];

export type AcoesDaConta = {
  /** Texto do botão do portal da Stripe; null quando não há assinatura no cartão para gerenciar. */
  portal: string | null;
  /** Planos que a conta pode contratar agora, na ordem da tela. */
  planos: PlanoId[];
};

/**
 * O QUE A CONTA PODE CONTRATAR AGORA — a regra única da tela e da rota.
 *
 * Três planos convivendo abrem um jeito novo de errar com o dinheiro dos outros:
 * vender um segundo plano para quem já paga o primeiro.
 *
 * - Assinatura cobrando no cartão: nada novo. Vender o Pix por cima cobraria o
 *   mesmo período duas vezes; trocar de plano é cancelar no portal primeiro.
 * - Assinatura em teste: o cartão entra pelo portal. Uma segunda assinatura seria
 *   uma segunda cobrança quando o teste acabar. Pix e anual podem, e começam
 *   depois do teste (lib/billing/passe.ts).
 * - Passe valendo: dá para estender. O mensal espera o passe acabar, porque a
 *   assinatura começaria a cobrar por dias que já estão pagos.
 */
export function acoesDaConta(p: {
  estado: EstadoConta;
  subscriptionStatus: string | null;
}): AcoesDaConta {
  const s = p.subscriptionStatus ?? "";

  if (COBRANDO_NO_CARTAO.includes(s)) {
    return {
      portal: s === "active" ? "Gerenciar assinatura" : "Atualizar forma de pagamento",
      planos: [],
    };
  }
  if (s === "trialing") return { portal: "Gerenciar assinatura", planos: [...SO_AVULSOS] };
  if (p.estado === "PASSE") return { portal: null, planos: [...SO_AVULSOS] };
  return { portal: null, planos: [...ORDEM_DA_TELA] };
}

/**
 * A mesma regra, do lado da rota: recusa com o motivo e o caminho. A rota nunca
 * pode aceitar um plano que a tela não mostraria — o teste compara as duas em
 * todas as combinações.
 */
export function planoDisponivel(p: {
  plano: PlanoId;
  estado: EstadoConta;
  subscriptionStatus: string | null;
}): { pode: true } | { pode: false; motivo: string } {
  if (acoesDaConta(p).planos.includes(p.plano)) return { pode: true };

  const s = p.subscriptionStatus ?? "";
  if (s === "active") {
    return {
      pode: false,
      motivo:
        "Você já tem a assinatura mensal no cartão, e outro plano por cima cobraria o mesmo " +
        "período duas vezes. Para trocar, cancele em “Gerenciar assinatura” — o acesso continua " +
        "até o fim do período pago — e depois escolha o novo plano.",
    };
  }
  if (COBRANDO_NO_CARTAO.includes(s)) {
    return {
      pode: false,
      motivo:
        "O último pagamento da sua assinatura no cartão não passou, e a Stripe continua tentando " +
        "cobrar. Para seguir no cartão, atualize-o em “Atualizar forma de pagamento”. Para pagar " +
        "de outro jeito sem ser cobrado duas vezes, cancele a assinatura por lá antes.",
    };
  }
  if (s === "trialing") {
    return {
      pode: false,
      motivo:
        "Sua assinatura mensal já existe e está no período de teste. Para cadastrar o cartão, use " +
        "“Gerenciar assinatura”. Se preferir o Pix, escolha 30 dias ou o anual.",
    };
  }
  return {
    pode: false,
    motivo:
      "Seus dias pagos ainda estão valendo. A assinatura no cartão fica disponível quando esses " +
      "dias acabarem; até lá, dá para estender no Pix ou no anual.",
  };
}
