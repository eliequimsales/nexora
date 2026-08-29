/**
 * PREÇO.
 *
 * R$ 97/mês, preço único. Decisão do fundador em 28/08/2026, com a barreira de
 * entrada priorizada sobre a margem: sem prova nenhuma e sem tráfego pago, o
 * que trava a Nexora hoje é conseguir o primeiro cliente, não o que ele paga.
 *
 * O número mora aqui sozinho de propósito. Trocar de preço é criar outro Price
 * na Stripe e mudar uma variável de ambiente — quem já assinou continua no
 * Price antigo, porque a Stripe nunca migra assinante sozinho. O que é
 * irreversível é o comportamento fiscal do Price, não o valor.
 */

/** R$ 97,00 — com imposto EMBUTIDO, já que o Stripe Tax não cobre o Brasil. */
export const PRECO_MENSAL_CENTS = 9_700;

export function emReais(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
