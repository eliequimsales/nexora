/**
 * runRevenueAssessment — orquestrador da PROMESSA da Nexora.
 *
 * Fluxo (Constituição, Artigos VII/VIII; ordem de implementação do fundador):
 *   CSV bruto → SignalProvider.parse → SignalProvider.toSignals → RevenueEngine → DecisionEngine → AssessmentResult
 *
 * STUB PROPOSITAL: lança NOT_IMPLEMENTED. O Teste de Valor (BDD) deve FALHAR até
 * que cada fatia (Provider CSV → Revenue → Decision) seja implementada com TDD.
 * Não preencher este corpo "para passar" — ele só fica verde quando a experiência existir.
 */

import type { AssessmentResult } from '../contracts/revenue.contracts';

export interface RunAssessmentOptions {
  orgId: string;
  annualRevenueCents?: number;
  marginPctDefault?: number;
}

export async function runRevenueAssessment(
  _csvRaw: string,
  _opts: RunAssessmentOptions,
): Promise<AssessmentResult> {
  throw new Error(
    'NOT_IMPLEMENTED: o Teste de Valor deve falhar até a fatia completa (CSV → Provider → Revenue Engine → Decision) existir.',
  );
}
