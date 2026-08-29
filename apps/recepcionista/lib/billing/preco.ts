/**
 * PREÇO.
 *
 * R$ 197/mês de lista, R$ 97/mês travado para os 20 primeiros.
 *
 * Não é desconto de lançamento nem meio-termo. São duas restrições diferentes
 * em dois momentos: hoje o que limita é DEMANDA — não existe prova nenhuma, e
 * preço alto sem prova não fecha. Depois o que limita é CAPACIDADE — uma pessoa
 * só não atende 125 donos de barbearia sem a qualidade cair e o churn comer a
 * base. Um preço único acerta uma das duas e erra a outra.
 *
 * A cohort compra a prova que falta com a única moeda disponível, e o preço
 * fica travado de verdade porque a Stripe mantém o Price de quem já assinou —
 * assinante antigo nunca é migrado sozinho.
 *
 * Preço não é porta de mão única: criar outro Price e trocar a variável leva
 * dois minutos. O que é irreversível é o comportamento fiscal do Price.
 */

/** R$ 197,00 — teto do que fecha sem ligação de vendas. */
export const PRECO_LISTA_CENTS = 19_700;

/** R$ 97,00 — travado para sempre para quem entrar na cohort. */
export const PRECO_FUNDADOR_CENTS = 9_700;

export const VAGAS_FUNDADOR = 20;

export type Preco = {
  cents: number;
  fundador: boolean;
  vagasRestantes: number;
  /** Nome da variável de ambiente que guarda o price_... correspondente. */
  variavel: "STRIPE_PRICE_FUNDADOR" | "STRIPE_PRICE_PRO";
};

/**
 * Qual preço vale para o próximo assinante.
 *
 * `assinantes` é a contagem real de contas pagantes. A escassez que a tela
 * mostra é contada pelo banco, nunca escrita à mão: "restam 6 vagas" só pode
 * aparecer se 6 for verdade. Escassez inventada é a mesma publicidade enganosa
 * que a Constituição proíbe — e num produto vendido como "risco zero" ela custa
 * a única coisa que sustenta o preço, que é a confiança.
 */
export function precoDaVez(assinantes: number): Preco {
  const usadas = Math.max(0, assinantes);
  const restantes = Math.max(0, VAGAS_FUNDADOR - usadas);
  const fundador = restantes > 0;

  return {
    cents: fundador ? PRECO_FUNDADOR_CENTS : PRECO_LISTA_CENTS,
    fundador,
    vagasRestantes: restantes,
    variavel: fundador ? "STRIPE_PRICE_FUNDADOR" : "STRIPE_PRICE_PRO",
  };
}

export function emReais(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
