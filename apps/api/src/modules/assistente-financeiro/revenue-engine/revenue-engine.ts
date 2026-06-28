/**
 * RevenueEngine — o MOTOR UNIVERSAL (Constituição, Artigo VII).
 *
 * Só consome RevenueSignal normalizado. NÃO conhece setor, RFM, recência crua —
 * qualquer Signal Provider (CSV/RFM, Subscription, B2B...) alimenta o mesmo motor.
 * Artigo X: a saída primária é R$ recuperável.
 */

import type {
  AssessmentInput,
  Confidence,
  ConfidenceLevel,
  RevenueSignal,
} from '../contracts/revenue.contracts';

export interface RecoverableItem {
  externalId: string;
  recoverableCents: number;
}

export interface EngineAssessment {
  items: RecoverableItem[];
  totalRecoverableCents: number;
  confidence: Confidence;
}

/** Meia-amostra: nº de clientes onde o volume já contribui ~63% da confiança. */
const VOLUME_HALFLIFE = 50;

export class RevenueEngine {
  assess(signals: RevenueSignal[], input: AssessmentInput): EngineAssessment {
    const items: RecoverableItem[] = signals.map((s) => ({
      externalId: s.externalId,
      // Artigo VI: recuperável nunca é negativo — custo > ganho é oportunidade zero, não dívida.
      recoverableCents: Math.max(
        0,
        Math.round(s.pReturn * s.futureValueCents) - s.recoveryCostCents,
      ),
    }));

    const totalRecoverableCents = items.reduce((sum, i) => sum + i.recoverableCents, 0);

    return {
      items,
      totalRecoverableCents,
      confidence: computeConfidence(signals.length, input),
    };
  }
}

/**
 * Confiança honesta em duas camadas (Artigo VI):
 *  - cobertura: quão limpo é o dado (validRows/totalRows do Signal Provider);
 *  - volume: tamanho da amostra (satura — poucos clientes nunca dão "alta confiança").
 * pct = cobertura × fator de volume. Dado sujo OU amostra pequena derruba a confiança.
 */
function computeConfidence(volume: number, input: AssessmentInput): Confidence {
  const coverage = input.dataQuality?.coverage ?? 1;
  const volumeFactor = 1 - Math.exp(-volume / VOLUME_HALFLIFE);
  const pct = Math.round(coverage * volumeFactor * 100);

  const level = toLevel(pct);
  const reason =
    `cobertura ${Math.round(coverage * 100)}% × volume ${volume} cliente(s)` +
    ` → confiança ${pct}% (${level}).`;

  return { pct, level, reason };
}

function toLevel(pct: number): ConfidenceLevel {
  if (pct < 25) return 'preliminary';
  if (pct < 50) return 'low';
  if (pct < 75) return 'medium';
  return 'high';
}
