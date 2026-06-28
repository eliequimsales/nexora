/**
 * DecisionEngine — onde o número vira DECISÃO DE DONO (Regra Zero / Art. IV).
 *
 * Só consome a saída do RevenueEngine (EngineAssessment): nada de CSV, RFM ou setor.
 * Constrói a fila de prioridade por R$ (Art. X), não dashboard.
 */

import type { Action, ConfidenceLevel, RecoverableCause } from '../contracts/revenue.contracts';
import type { EngineAssessment } from '../revenue-engine/revenue-engine';

export interface RankedOpportunity {
  externalId: string;
  recoverableCents: number;
  /** RRI operacional 0–100: percentil interno de R$ — ranking, nunca o número de venda. */
  rriOperational: number;
  /** Regra Zero (Art. IV): EXATAMENTE uma ação por oportunidade. */
  action: Action;
}

export interface Decision {
  topOpportunities: RankedOpportunity[];
  /** RRI executivo (%): recuperável ÷ receita anual. null se receita anual desconhecida. */
  rriExecutivePct: number | null;
  /** Causas auditáveis (Guardrail 5): segmentos básicos que reconciliam com o total. */
  causes: RecoverableCause[];
}

const TOP_N = 3;

export class DecisionEngine {
  decide(assessment: EngineAssessment): Decision {
    // Regra Zero (Art. IV): a confiança define QUAL ação, nunca SE existe ação.
    const action = selectAction(assessment.confidence.level);

    const all = assessment.items;
    const byMoney = [...all].sort((a, b) => b.recoverableCents - a.recoverableCents); // Art. X
    const topOpportunities = byMoney.slice(0, TOP_N).map((item) => ({
      externalId: item.externalId,
      recoverableCents: item.recoverableCents,
      rriOperational: percentileRank(item.recoverableCents, all),
      action,
    }));

    return {
      topOpportunities,
      rriExecutivePct: executiveRri(assessment),
      causes: concentrationCauses(byMoney, assessment.totalRecoverableCents),
    };
  }
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

/** RRI executivo (%): quanto a receita recuperável representa da receita anual da org. */
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
function selectAction(level: ConfidenceLevel): Action {
  switch (level) {
    case 'preliminary':
      return {
        kind: 'increase_confidence',
        label: 'Melhorar dados antes de executar',
        executable: false,
      };
    case 'low':
      return {
        kind: 'create_campaign',
        label: 'Executar campanha piloto em pequena escala',
        executable: true,
      };
    case 'medium':
      return {
        kind: 'create_campaign',
        label: 'Executar campanha de recuperação',
        executable: true,
      };
    case 'high':
      return {
        kind: 'create_campaign',
        label: 'Executar recuperação automaticamente (quando permitido)',
        executable: true,
      };
  }
}

/** Percentil interno 0–100: % de oportunidades com R$ ≤ este. Maior R$ → 100. */
function percentileRank(value: number, items: { recoverableCents: number }[]): number {
  if (items.length === 0) return 0;
  const atOrBelow = items.filter((i) => i.recoverableCents <= value).length;
  return Math.round((atOrBelow / items.length) * 100);
}
