/**
 * CICLO PESSOAL
 *
 * O intervalo mediano entre as visitas de UM cliente. É a peça que faz a
 * recuperação deixar de ser lista estática: com o ciclo pessoal dá para saber
 * quem está atrasado em relação a si mesmo, em vez de aplicar uma regra global
 * de "60 dias" que erra em todo mundo — 40 dias é sumiço para quem corta o
 * cabelo a cada 24, e é rotina normal para quem vai ao salão a cada 45.
 *
 * Usa MEDIANA e não média de propósito: uma viagem de três meses distorce a
 * média e faz o sistema achar que o comportamento normal do cliente mudou.
 */

export type Confianca = "alta" | "baixa";

export type Ciclo = {
  /** Intervalo mediano em dias entre visitas. */
  dias: number;
  confianca: Confianca;
  visitas: number;
  /** Explicação em português para mostrar na tela. Verdade acima de marketing. */
  motivo: string;
};

/** Mínimo de visitas para confiar no ciclo do próprio cliente. */
const MIN_VISITAS_CONFIAVEL = 3;

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Medianas de referência por segmento, usadas apenas como FALLBACK quando o
 * cliente ainda não tem histórico suficiente — e sempre marcadas como
 * confiança baixa na tela.
 */
export const MEDIANA_POR_SEGMENTO: Record<string, number> = {
  barbearia: 24,
  "salao-de-beleza": 38,
  estetica: 30,
  "pet-shop": 28,
  academia: 7,
  odontologia: 180,
  fisioterapia: 14,
  padrao: 30,
};

export function medianaDoSegmento(segmento: string | null | undefined): number {
  if (!segmento) return MEDIANA_POR_SEGMENTO.padrao;
  return MEDIANA_POR_SEGMENTO[segmento] ?? MEDIANA_POR_SEGMENTO.padrao;
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 === 1) return ordenados[meio];
  return Math.round((ordenados[meio - 1] + ordenados[meio]) / 2);
}

export function calcularCiclo(visitas: Date[], medianaSegmentoDias: number): Ciclo {
  // Um dia com duas visitas registradas é erro de importação, não ciclo de
  // zero dia — colapsa para uma visita só.
  const diasUnicos = Array.from(
    new Set(visitas.map((v) => Math.floor(v.getTime() / DIA_MS))),
  ).sort((a, b) => a - b);

  const total = diasUnicos.length;

  if (total < MIN_VISITAS_CONFIAVEL) {
    return {
      dias: medianaSegmentoDias,
      confianca: "baixa",
      visitas: total,
      motivo:
        total === 0
          ? "Nenhuma visita registrada. Estamos usando a média do segmento — trate como palpite, não como previsão."
          : `Só ${total} visita${total === 1 ? "" : "s"} registrada${total === 1 ? "" : "s"}. Não dá para saber o ciclo dele; estamos usando a média do segmento e o valor pode errar bastante.`,
    };
  }

  const intervalos: number[] = [];
  for (let i = 1; i < diasUnicos.length; i += 1) {
    intervalos.push(diasUnicos[i] - diasUnicos[i - 1]);
  }

  return {
    dias: mediana(intervalos),
    confianca: "alta",
    visitas: total,
    motivo: `${total} visitas sustentam essa conta.`,
  };
}
