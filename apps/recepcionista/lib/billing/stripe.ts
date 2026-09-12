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

/** As duas variáveis sem as quais não existe cobrança. Nomes, nunca valores. */
export const VARIAVEIS_DA_STRIPE = ["STRIPE_SECRET_KEY", "STRIPE_PRICE_PRO"] as const;

/**
 * Quais das duas ainda faltam.
 *
 * Existe para a tela poder dizer o QUE fazer. "A cobrança não está configurada"
 * manda o dono procurar sozinho entre chave, preço e webhook; o nome da variável
 * que falta é uma tarefa de trinta segundos no painel do Railway.
 */
export function variaveisPendentesDaStripe(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return VARIAVEIS_DA_STRIPE.filter((chave) => !(env[chave] ?? "").trim());
}

export function stripeConfigurado(): boolean {
  return variaveisPendentesDaStripe().length === 0;
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
