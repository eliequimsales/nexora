/**
 * ATRIBUIÇÃO — o que a Nexora pode dizer que recuperou.
 *
 * O campo `RecoveryEntry.attributed` estava `@default(true)` e a rota da Onda
 * nunca o passava. Todo retorno entrava como recuperação da Nexora, inclusive
 * o cliente que ia voltar de qualquer jeito. Enquanto isso, a tela de
 * assinatura afirmava aplicar "janela de atribuição de 21 dias" — a mesma
 * falha de sempre: o produto afirmando o que o código não faz.
 *
 * E aqui dói mais do que nos outros casos, porque o número inflado é a NORTH
 * STAR. O Livro-Caixa existe para o dono responder "vale os R$ 97?" olhando o
 * próprio caixa. Um número que ele não consegue explicar para si mesmo não
 * responde nada — e quando ele desconfiar de um, desconfia do produto inteiro.
 *
 * DUAS CONDIÇÕES, e as duas precisam valer:
 *
 *   1. Voltou até 21 dias depois do contato. Passou disso, a mensagem já não é
 *      a explicação mais provável do retorno.
 *   2. Estava além de 1,5x o ciclo pessoal dele. Dentro do ritmo, ele voltaria
 *      sozinho — contar isso é cobrar pelo que ia acontecer de qualquer jeito.
 *
 * NA DÚVIDA, NÃO ATRIBUI. Sem ciclo confiável não dá para afirmar que ele não
 * voltaria só. O erro seguro aqui é para MENOS: um extrato menor e defensável
 * vale mais na renovação do que um maior que não se sustenta.
 *
 * O que não é atribuído não some — vai para a coluna "voltou sem atribuição",
 * separada e nunca somada ao total.
 */

export const JANELA_DIAS = 21;
export const MULTIPLO_DO_CICLO = 1.5;

export function ehAtribuivel(entrada: {
  /** Dias entre o toque enviado e o retorno. */
  diasDesdeOToque: number;
  /** Dias que o cliente estava sem aparecer quando voltou. */
  diasSumido: number;
  /** Ciclo pessoal dele. Zero quando não há histórico suficiente. */
  cicloDias: number;
}): boolean {
  const { diasDesdeOToque, diasSumido, cicloDias } = entrada;

  // Toque no futuro é dado corrompido, não retorno rápido.
  if (!Number.isFinite(diasDesdeOToque) || diasDesdeOToque < 0) return false;
  if (diasDesdeOToque > JANELA_DIAS) return false;

  // Sem ciclo não há como dizer que ele estava fora do ritmo.
  if (!Number.isFinite(cicloDias) || cicloDias <= 0) return false;

  return diasSumido > cicloDias * MULTIPLO_DO_CICLO;
}
