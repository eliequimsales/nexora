/**
 * MOTIVOS DE PULO — e quais deles silenciam o cliente para sempre.
 *
 * Fonte única: a rota valida por esta lista, a tela renderiza por esta lista, e
 * a decisão de silenciar sai desta função. Antes disso o enum morava na rota, os
 * rótulos moravam na tela, e a regra de silenciar era um `!== "OUTRO"` solto —
 * três lugares para uma coisa só, que foi exatamente como o buraco apareceu.
 *
 * DUAS FAMÍLIAS DIFERENTES, e a diferença não é decorativa:
 *
 *   FUTILIDADE — mudou de cidade, não é mais cliente, faleceu, era de evento.
 *   Não adianta mandar. É uma decisão de EFICIÊNCIA, e o dono pode rever.
 *
 *   CONSENTIMENTO — o cliente pediu para parar.
 *   Não é que não adianta: é que não pode. A LGPD trata isso como revogação de
 *   consentimento, e o registro de QUEM pediu e QUANDO precisa existir. Fica em
 *   RecoveryTouch.skipReason, junto do outcomeAt — é a prova de que foi honrado.
 *
 * "OUTRO" NÃO silencia de propósito: motivo desconhecido não é consentimento
 * retirado, e silenciar por engano é invisível para o dono e definitivo para o
 * cliente.
 */

export const MOTIVOS_PULO = [
  "PEDIU_PARAR",
  "MUDOU_CIDADE",
  "NAO_E_CLIENTE",
  "FALECEU",
  "EVENTO",
  "OUTRO",
] as const;

export type MotivoPulo = (typeof MOTIVOS_PULO)[number];

const ROTULOS: Record<MotivoPulo, string> = {
  PEDIU_PARAR: "Pediu para parar",
  MUDOU_CIDADE: "Mudou de cidade",
  NAO_E_CLIENTE: "Não é mais cliente",
  FALECEU: "Faleceu",
  EVENTO: "Só cliente de evento",
  OUTRO: "Outro",
};

/** Único motivo que NÃO silencia é o desconhecido. */
export function deveSilenciar(motivo: MotivoPulo | undefined | null): boolean {
  if (!motivo) return false;
  if (!MOTIVOS_PULO.includes(motivo as MotivoPulo)) return false;
  return motivo !== "OUTRO";
}

export function rotuloDoMotivo(motivo: MotivoPulo): string {
  return ROTULOS[motivo];
}
