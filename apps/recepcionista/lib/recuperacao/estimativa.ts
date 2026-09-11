/**
 * A CONTA DO DINHEIRO RECUPERÁVEL — um lugar só.
 *
 * Duas telas dizem ao dono quanto dinheiro está parado: a calculadora da home,
 * com três números que ele digita, e o diagnóstico, com a lista dele. Se cada
 * uma tivesse a própria fórmula, bastaria alguém ajustar a taxa num lugar para
 * a home prometer um valor e o diagnóstico mostrar outro — para a mesma base.
 *
 * Por isso a regra mora aqui e as duas importam. tests/estimativa.test.ts
 * reprova se o diagnóstico voltar a declarar as próprias taxas.
 */

/** Faixa de reativação observada em campanhas de recuperação, em 90 dias. */
export const TAXA_MIN = 0.15;
export const TAXA_MAX = 0.25;
export const JANELA_DIAS = 90;
/** Teto de visitas projetadas. Ciclo semanal daria 13 na janela — projetar
 *  isso é fantasia, ninguém recupera alguém e mantém 13 idas seguidas. */
export const MAX_VISITAS_PROJETADAS = 4;

/** Abaixo disto não há o que recuperar: o Corte Honesto entra. */
export const MIN_SUMIDOS = 25;
export const MIN_RECUPERAVEL_CENTS = 50_000;

const porcento = (taxa: number) => `${Math.round(taxa * 100)}%`;

/** "15% a 25%", derivado das taxas: o texto nunca envelhece sozinho. */
export const FAIXA_EM_TEXTO = `${porcento(TAXA_MIN)} a ${porcento(TAXA_MAX)}`;

/**
 * Quantas vezes o cliente recuperado voltaria na janela, retomando o ciclo
 * dele. Contar só uma subestima em 3x — subestimar também é impreciso.
 */
export function visitasNaJanela(cicloDias: number): number {
  return Math.max(
    1,
    Math.min(MAX_VISITAS_PROJETADAS, Math.round(JANELA_DIAS / Math.max(1, cicloDias))),
  );
}

export function faixaRecuperavel(potencialCents: number): {
  min: number;
  central: number;
  max: number;
} {
  const min = Math.round(potencialCents * TAXA_MIN);
  const max = Math.round(potencialCents * TAXA_MAX);
  return { min, central: Math.round((min + max) / 2), max };
}

export function abaixoDoCorte(sumidos: number, minCents: number): boolean {
  return sumidos < MIN_SUMIDOS || minCents < MIN_RECUPERAVEL_CENTS;
}
