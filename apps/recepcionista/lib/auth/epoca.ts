/**
 * REVOGACAO DE SESSAO.
 *
 * O JWT e sem estado, dura 7 dias e nao tinha revogacao nenhuma: trocar a
 * senha so reescrevia o hash e o logout so apagava o cookie do proprio
 * navegador. Quem tivesse roubado o cookie continuava dentro por uma semana --
 * exatamente depois da acao que a vitima toma para se proteger.
 *
 * A epoca e um contador na conta. O token carrega a epoca em que nasceu, e
 * incrementar o contador invalida de uma vez todos os tokens emitidos antes.
 * Custa uma coluna e nenhuma consulta a mais: o companyId ja e buscado.
 */

export function sessaoAindaVale(
  epocaDoToken: number | null | undefined,
  epocaDaConta: number,
): boolean {
  // Token sem epoca e anterior a esta mudanca. Recusar e a escolha certa:
  // aceitar "por compatibilidade" manteria viva justamente a sessao que a
  // revogacao existe para matar.
  if (typeof epocaDoToken !== "number" || !Number.isInteger(epocaDoToken)) return false;
  return epocaDoToken === epocaDaConta;
}
