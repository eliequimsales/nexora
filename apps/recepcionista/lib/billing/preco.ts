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

/**
 * FORMAS DE PAGAMENTO ACEITAS.
 *
 * Isto não é escolha de texto: é o espelho do que está LIGADO no dashboard da
 * Stripe. As telas derivam a frase daqui em vez de escreverem "cartão ou
 * boleto" na mão, porque prometer um meio que o checkout não oferece é o
 * cliente descobrir a mentira exatamente na hora de pagar — e o TypeScript
 * nunca vai pegar isso, já que a verdade mora fora do repositório.
 *
 * Em 30/08/2026 o dashboard tem cartões, Apple Pay, Google Pay e Link — todos
 * cartão por baixo, e por isso uma palavra só. O BOLETO está desligado de
 * propósito: ligá-lo exige antes auditar o fluxo assíncrono contra o motor de
 * inadimplência, porque um boleto ainda NÃO PAGO não é falha de pagamento e
 * não pode disparar os 7 dias de tolerância nem bloquear ninguém.
 *
 * Para ligar boleto depois: habilite na Stripe, acrescente "boleto" aqui, e o
 * teste em tests/formas-pagamento.test.ts libera as telas sozinho.
 */
export const FORMAS_DE_PAGAMENTO: readonly string[] = ["cartão"];

/** "cartão" · "cartão ou boleto" · "cartão, boleto ou Pix" */
export function formasDePagamentoTexto(
  formas: readonly string[] = FORMAS_DE_PAGAMENTO,
): string {
  if (formas.length === 0) return "";
  if (formas.length === 1) return formas[0];
  return `${formas.slice(0, -1).join(", ")} ou ${formas[formas.length - 1]}`;
}
