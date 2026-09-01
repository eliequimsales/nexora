import { createHmac } from "node:crypto";
import { variantesDeTelefone } from "@/lib/recuperacao/telefone";

/**
 * ELIMINAÇÃO DE UM CLIENTE FINAL — LGPD art. 18, VI.
 *
 * O Contrato de Operador promete executar o pedido do titular em até 15 dias.
 * Promessa que depende de alguém lembrar de rodar DELETE na mão não é
 * promessa: é intenção. Aqui ela vira plano executável.
 *
 * Duas decisões que um DELETE ingênuo erraria:
 *
 * 1. RecoveryEntry NÃO é apagado, é anonimizado. Ele é o Livro-Caixa da
 *    Recuperação — registro financeiro do DONO, não dado pessoal do cliente.
 *    Apagar reescreveria o faturamento passado, e Receita Recuperada
 *    comprovada é o North Star do produto. O art. 16 da LGPD permite a
 *    conservação; o que sai é o vínculo com a pessoa, não o valor.
 *
 * 2. Quem pediu PARAR e foi apagado VOLTA na próxima importação da mesma
 *    planilha — e é contatado de novo. Feita sem cuidado, a exclusão desfaz o
 *    opt-out e transforma um direito exercido em incômodo repetido. Por isso
 *    o telefone de quem pediu para parar sobrevive como hash: o suficiente
 *    para reconhecer e barrar, insuficiente para contatar.
 */

export type ClienteParaExcluir = {
  id: string;
  telefone: string;
  optOut: boolean;
  visitas: number;
  toques: number;
  agendamentosFuturos: number;
  recuperacoes: { id: string; valorCents: number }[];
};

export type PlanoDeExclusao = {
  apagar: { customerId: string; visitas: number; toques: number; agendamentos: number };
  /** ids de RecoveryEntry que perdem o vínculo mas mantêm o valor. */
  anonimizar: string[];
  valorPreservadoCents: number;
  /** hash do telefone, só quando havia opt-out a preservar. */
  suprimir: string | null;
};

/**
 * Uma forma só para o mesmo número. O sistema guarda o mesmo cliente como
 * 11988881234, 5511988881234 e 1188881234; se cada grafia gerasse um hash, a
 * lista de supressão barraria uma e deixaria as outras duas passarem.
 * A variante mais longa (55 + DDD + nono dígito) é o representante estável.
 */
export function telefoneCanonico(bruto: string): string | null {
  const variantes = variantesDeTelefone(bruto);
  if (variantes.length === 0) return null;
  return variantes.reduce((maior, v) => (v.length > maior.length ? v : maior));
}

/**
 * HMAC, não SHA-256 puro. Telefone brasileiro tem ~11 dígitos: um digest
 * simples é quebrável por força bruta em minutos, e a "lista anônima" viraria
 * uma lista de telefones com passo extra. Com chave, o hash só é comparável
 * por quem tem o servidor.
 *
 * Sem JWT_SECRET definido a proteção degrada para um digest sem chave — o
 * mesmo ambiente em que a autenticação também não funciona.
 */
export function hashTelefone(bruto: string): string | null {
  const canonico = telefoneCanonico(bruto);
  if (!canonico) return null;
  const chave = process.env.SUPRESSAO_SECRET ?? process.env.JWT_SECRET ?? "";
  return createHmac("sha256", chave).update(`telefone:${canonico}`).digest("hex");
}

export function planejarExclusaoDeCliente(c: ClienteParaExcluir): PlanoDeExclusao {
  return {
    apagar: {
      customerId: c.id,
      visitas: c.visitas,
      toques: c.toques,
      agendamentos: c.agendamentosFuturos,
    },
    anonimizar: c.recuperacoes.map((r) => r.id),
    valorPreservadoCents: c.recuperacoes.reduce((s, r) => s + r.valorCents, 0),
    // Só quem exerceu o direito de parar entra na lista. Guardar o hash de
    // todo mundo que já foi apagado seria construir, em nome da privacidade,
    // exatamente o cadastro sombra que a LGPD quer impedir.
    suprimir: c.optOut ? hashTelefone(c.telefone) : null,
  };
}

/**
 * A supressão aplicada na entrada da base.
 *
 * Sem isto a lista de supressão seria decoração: o dono reimporta a mesma
 * planilha do mês passado e quem pediu PARAR volta, é contatado de novo, e o
 * direito exercido vira incômodo repetido — que é exatamente a reclamação que
 * chega na ANPD.
 *
 * Roda também na SIMULAÇÃO, de propósito: o dono precisa ver na prévia que N
 * pessoas ficaram de fora, senão a conta não fecha e ele acha que o parser
 * falhou.
 */
export function filtrarSuprimidos<T extends { telefone: string }>(
  clientes: T[],
  hashes: Set<string>,
): { permitidos: T[]; suprimidos: number } {
  if (hashes.size === 0) return { permitidos: clientes, suprimidos: 0 };

  const permitidos = clientes.filter((c) => {
    const h = hashTelefone(c.telefone);
    // Telefone que nem o canonizador entende não é barrado aqui: quem decide
    // se a linha serve é o parser, e barrar por não entender esconderia o erro.
    return h === null || !hashes.has(h);
  });

  return { permitidos, suprimidos: clientes.length - permitidos.length };
}
