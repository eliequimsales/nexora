/**
 * DecisionEngine — onde o número vira DECISÃO DE DONO (Regra Zero / Art. IV).
 *
 * Só consome a saída do CustomerRecoveryEngine (EngineAssessment): nada de CSV, RFM ou setor.
 * Constrói a fila de prioridade por R$ (Art. X), não dashboard.
 */

import type {
  RecoveryAction,
  ConfidenceLevel,
  RecoverableCause,
  RecoveryStrategy,
} from '../contracts/recovery.contracts';
import type { EngineAssessment } from '../customer-recovery-engine/customer-recovery-engine';

export interface RecoveryOpportunity {
  externalId: string;
  recoverableCents: number;
  /** RRI operacional 0–100: percentil interno de R$ — ranking, nunca o número de venda. */
  rriOperational: number;
  /** Regra Zero (Art. IV): EXATAMENTE uma ação por oportunidade. */
  action: RecoveryAction;
  /** Guardrail 5: por que está no Top 3, rastreável aos números. */
  why: string;
  /** Nome do cliente (se a fonte trouxer). Preenchido pelo orquestrador. */
  name?: string;
  /** Estratégia de recuperação (o cérebro). Preenchida pelo orquestrador. */
  strategy?: RecoveryStrategy;
}

export interface Decision {
  /** Quantos clientes valem a pena recuperar (recoverableCents > 0). */
  recoverableCount: number;
  topOpportunities: RecoveryOpportunity[];
  /** RRI executivo (%): recuperável ÷ receita anual. null se receita anual desconhecida. */
  rriExecutivePct: number | null;
  /** Causas auditáveis (Guardrail 5): segmentos básicos que reconciliam com o total. */
  causes: RecoverableCause[];
  /** Faixa honesta do valor potencial (Art. VI): mais confiança → mais estreita. */
  rangeLowCents: number;
  rangeHighCents: number;
}

const TOP_N = 3;

export class DecisionEngine {
  decide(assessment: EngineAssessment): Decision {
    // Regra Zero (Art. IV): a confiança define QUAL ação, nunca SE existe ação.
    const action = selectAction(assessment.confidence.level);

    const all = assessment.items;
    const byMoney = [...all].sort((a, b) => b.recoverableCents - a.recoverableCents); // Art. X
    const pct = assessment.confidence.pct;
    const topOpportunities = byMoney.slice(0, TOP_N).map((item) => {
      const rriOperational = percentileRank(item.recoverableCents, all);
      return {
        externalId: item.externalId,
        recoverableCents: item.recoverableCents,
        rriOperational,
        action,
        why:
          `${formatBRL(item.recoverableCents)} recuperável · ` +
          `prioridade ${rriOperational}/100 · confiança ${pct}%`,
      };
    });

    const [rangeLowCents, rangeHighCents] = confidenceRange(
      assessment.totalRecoverableCents,
      pct,
    );

    return {
      recoverableCount: all.filter((i) => i.recoverableCents > 0).length,
      topOpportunities,
      rriExecutivePct: executiveRri(assessment),
      causes: concentrationCauses(byMoney, assessment.totalRecoverableCents),
      rangeLowCents,
      rangeHighCents,
    };
  }
}

/**
 * Faixa honesta em torno do total (Art. VI): incerteza u = 1 − confiança.
 * 80% → ±20% ; 30% → ±70%. Low nunca negativo. Mais confiança → faixa mais estreita.
 */
function confidenceRange(total: number, pct: number): [number, number] {
  const u = 1 - pct / 100;
  const low = Math.max(0, Math.round(total * (1 - u)));
  const high = Math.round(total * (1 + u));
  return [low, high];
}

/**
 * Causas básicas e auditáveis (Guardrail 5), só com a saída do motor (trava: sem setor):
 * concentração do dinheiro no Top 3 vs. a cauda. Reconciliam com o total.
 */
function concentrationCauses(
  byMoney: { recoverableCents: number }[],
  total: number,
): RecoverableCause[] {
  if (total <= 0) return [];

  const topSum = byMoney.slice(0, TOP_N).reduce((s, i) => s + i.recoverableCents, 0);
  const tailSum = total - topSum;

  const causes: RecoverableCause[] = [
    { label: 'Top 3 clientes', recoverableCents: topSum, pctOfTotal: (topSum / total) * 100 },
  ];
  if (tailSum > 0) {
    causes.push({
      label: 'Demais clientes',
      recoverableCents: tailSum,
      pctOfTotal: (tailSum / total) * 100,
    });
  }
  return causes;
}

/** RRI executivo (%): quanto a valor potencial recuperável representa da receita anual da org. */
function executiveRri(assessment: EngineAssessment): number | null {
  const annual = assessment.annualRevenueCents;
  if (annual === null || annual <= 0) return null;
  return Math.round((assessment.totalRecoverableCents / annual) * 100);
}

/**
 * A ação escala com a confiança (Art. IV + Art. VI): nunca trava a tela, mas
 * nunca exagera o que a evidência permite. Dado insuficiente → o próximo passo
 * honesto é melhorar o dado; daí em diante, recuperar — piloto → recomendada → automática.
 */
function selectAction(level: ConfidenceLevel): RecoveryAction {
  switch (level) {
    case 'preliminary':
      return {
        kind: 'increase_confidence',
        label: 'Melhorar dados antes de executar',
        executable: false,
        riskCopy: 'Dados insuficientes — não execute ainda; melhore a base primeiro.',
      };
    case 'low':
      return {
        kind: 'create_campaign',
        label: 'Executar campanha piloto em pequena escala',
        executable: true,
        riskCopy: 'Confiança baixa — rode um piloto pequeno antes de escalar.',
      };
    case 'medium':
      return {
        kind: 'create_campaign',
        label: 'Executar campanha de recuperação',
        executable: true,
        riskCopy: 'Confiança média — execute acompanhando os resultados de perto.',
      };
    case 'high':
      return {
        kind: 'create_campaign',
        label: 'Executar recuperação automaticamente (quando permitido)',
        executable: true,
        riskCopy: 'Confiança alta — pode executar; ainda assim, monitore os retornos.',
      };
  }
}

/** Formata centavos como BRL: 9000 → "R$ 90,00". Localização final fica no frontend. */
function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

/** Percentil interno 0–100: % de oportunidades com R$ ≤ este. Maior R$ → 100. */
function percentileRank(value: number, items: { recoverableCents: number }[]): number {
  if (items.length === 0) return 0;
  const atOrBelow = items.filter((i) => i.recoverableCents <= value).length;
  return Math.round((atOrBelow / items.length) * 100);
}
