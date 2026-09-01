/**
 * O QUE UM FORMULÁRIO PÚBLICO PODE ESCREVER NA BASE DE OUTRA PESSOA.
 *
 * /api/agendar/[slug] não tem sessão: é o link que o dono manda no Instagram,
 * e qualquer um que tenha o link escreve em Customer — dado de terceiro dentro
 * da base do assinante. Isso pede regra explícita, não upsert solto.
 *
 * Duas decisões, e as duas vieram de erro real:
 *
 * 1. AGENDAR NÃO REVOGA O "PARAR". Quem pediu para não receber mensagem e
 *    depois marca horário está pedindo atendimento, não pedindo marketing. São
 *    dois consentimentos, e antes disto marcar um horário ressuscitava o
 *    cliente com optOut falso — desfazendo pela porta dos fundos o direito que
 *    ele tinha exercido.
 *
 * 2. FORMULÁRIO PÚBLICO NÃO REESCREVE A CADERNETA. O `update: { name }` que
 *    existia aqui deixava qualquer pessoa que soubesse um telefone trocar o
 *    nome daquele cliente na agenda do dono, sem autenticação. Quem sabe o
 *    nome do cliente é o dono; o formulário só marca horário.
 */

export type EntradaPorLink = {
  /** Dados para criar o cliente, ou null quando ele já existe. */
  criar: { name: string; optOut: boolean } | null;
  /** O que atualizar num cliente existente. Vazio de propósito. */
  atualizar: Record<string, never>;
};

export function entradaPorLink(ctx: {
  existe: boolean;
  nomeInformado: string;
  /** O telefone está na lista de supressão desta empresa. */
  suprimido: boolean;
}): EntradaPorLink {
  if (ctx.existe) return { criar: null, atualizar: {} };

  const nome = (ctx.nomeInformado ?? "").trim();

  return {
    // "Cliente" e não string vazia: a agenda do dono mostra essa linha, e
    // horário marcado sem nome nenhum parece falha do sistema.
    criar: { name: nome || "Cliente", optOut: ctx.suprimido },
    atualizar: {},
  };
}
