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

export interface RunAssessmentOptions {
  orgId: string;
  annualRevenueCents?: number;
  marginPctDefault?: number;
}

export interface CustomerRecoveryAssessment {
  totalRecoverableCents: number;
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
  });

  const input = await provider.parse(csvRaw);
  const signals = provider.toSignals(input);
  const assessment = new CustomerRecoveryEngine().assess(signals, input);
  const decision = new DecisionEngine().decide(assessment);

  return {
    totalRecoverableCents: assessment.totalRecoverableCents,
    confidence: assessment.confidence,
    rriExecutivePct: decision.rriExecutivePct,
    topOpportunities: decision.topOpportunities,
    causes: decision.causes,
  };
}
