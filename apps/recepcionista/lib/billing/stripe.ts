import Stripe from "stripe";

/**
 * Cliente Stripe.
 *
 * Instanciação PREGUIÇOSA de propósito. Se o cliente fosse criado no topo do
 * módulo, qualquer import indireto derrubaria o app inteiro em produção
 * enquanto a chave não estivesse configurada — e hoje ela não está. O produto
 * precisa continuar funcionando sem cobrança ligada.
 */

/**
 * Fixada no código, casada com o que o stripe@22.6.0 já embute
 * (`cjs/apiVersion.js` → `ApiVersion = '2026-08-26.dahlia'`). Fixar aqui garante
 * que os tipos do TypeScript e a forma do payload sejam a mesma coisa.
 */
export const STRIPE_API_VERSION = "2026-08-26.dahlia" as const;

let cliente: Stripe | null = null;

/**
 * Só o preço de lista é obrigatório. Sem `STRIPE_PRICE_FUNDADOR` a cohort
 * simplesmente não abre — o produto continua vendável, e é melhor cair no preço
 * cheio do que quebrar o checkout por uma variável de campanha faltando.
 */
export function stripeConfigurado(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_PRO);
}

export function stripe(): Stripe {
  if (cliente) return cliente;

  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave) throw new Error("STRIPE_SECRET_KEY não configurado");

  cliente = new Stripe(chave, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
    appInfo: { name: "nexora-recepcionista" },
    // Rede cai. Sem retry, um blip vira assinatura não criada com o dono
    // olhando para uma tela de erro logo depois de decidir pagar.
    maxNetworkRetries: 2,
  });
  return cliente;
}
