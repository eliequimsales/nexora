/**
 * runCustomerRecoveryAssessment — orquestrador da PROMESSA da Nexora.
 *
 * Liga os três órgãos já testados, sem feature nova (Constituição, Artigos VII/VIII):
 *   CSV bruto
 *     → CsvSignalProvider.parse      (normaliza + cobertura honesta)
 *     → CsvSignalProvider.toSignals  (sinais RFM normalizados)
 *     → CustomerRecoveryEngine.assess         (R$ recuperável + confiança)
 *     → DecisionEngine.decide        (Top 3 por R$, 1 ação, RRI, causas)
 *
 * Este é o ponto em que o Teste de Valor (BDD) finalmente fica verde: a Nexora
 * cumpre a promessa sobre dados reais. Range e `why` por oportunidade são fatias
 * futuras — aqui só ligamos o fio com o que já existe.
 */

import type { Confidence, RecoverableCause } from '../contracts/recovery.contracts';
import { CsvSignalProvider } from '../signal-providers/csv.signal-provider';
import { DecisionEngine, type RecoveryOpportunity } from '../decision-engine/decision-engine';
import { CustomerRecoveryEngine } from './customer-recovery-engine';
import { buildStrategy } from './recovery-strategy';

export interface RunAssessmentOptions {
  orgId: string;
  annualRevenueCents?: number;
  marginPctDefault?: number;
  /** Data de referência para recência. Injetável → avaliação determinística (Art. VI). */
  now?: Date;
}

export interface CustomerRecoveryAssessment {
  /** Quantos clientes valem a pena recuperar — o número-âncora da tela. */
  recoverableCount: number;
  totalRecoverableCents: number;
  /** Faixa honesta do valor potencial (Art. VI): mais confiança → mais estreita. */
  rangeLowCents: number;
  rangeHighCents: number;
  confidence: Confidence;
  rriExecutivePct: number | null;
  topOpportunities: RecoveryOpportunity[];
  causes: RecoverableCause[];
}

const DEFAULT_MARGIN_PCT = 0.5;

export async function runCustomerRecoveryAssessment(
  csvRaw: string,
  opts: RunAssessmentOptions,
): Promise<CustomerRecoveryAssessment> {
  const provider = new CsvSignalProvider({
    orgId: opts.orgId,
    marginPctDefault: opts.marginPctDefault ?? DEFAULT_MARGIN_PCT,
    annualRevenueCents: opts.annualRevenueCents,
    now: opts.now,
  });

  const input = await provider.parse(csvRaw);
  const signals = provider.toSignals(input);
  const assessment = new CustomerRecoveryEngine().assess(signals, input);
  const decision = new DecisionEngine().decide(assessment);

  // Enriquece cada oportunidade do Top 3 com nome + estratégia (o cérebro).
  const now = opts.now ?? new Date();
  const customerById = new Map(input.customers.map((c) => [c.externalId, c]));
  const pReturnById = new Map(signals.map((s) => [s.externalId, s.pReturn]));

  const topOpportunities: RecoveryOpportunity[] = decision.topOpportunities.map((op) => {
    const c = customerById.get(op.externalId);
    if (!c) return op;
    const frequency = c.purchases.length;
    const totalCents = c.purchases.reduce((a, p) => a + p.amountCents, 0);
    const avgTicketCents = frequency > 0 ? Math.round(totalCents / frequency) : 0;
    const recencyMonths = c.lastPurchaseAt
      ? (now.getTime() - c.lastPurchaseAt.getTime()) / 86_400_000 / 30
      : 999;
    return {
      ...op,
      name: c.name,
      strategy: buildStrategy({
        recencyMonths,
        frequency,
        avgTicketCents,
        pReturn: pReturnById.get(op.externalId) ?? 0,
      }),
    };
  });

  return {
    recoverableCount: decision.recoverableCount,
    totalRecoverableCents: assessment.totalRecoverableCents,
    rangeLowCents: decision.rangeLowCents,
    rangeHighCents: decision.rangeHighCents,
    confidence: assessment.confidence,
    rriExecutivePct: decision.rriExecutivePct,
    topOpportunities,
    causes: decision.causes,
  };
}
