/**
 * DecisionEngine — onde o número vira DECISÃO DE DONO (Constituição, Regra Zero / Art. IV).
 *
 * Trava: só consome a saída do RevenueEngine (EngineAssessment). Nada de CSV, RFM, setor.
 * Ordem: dinheiro primeiro (Top 3 por R$), 1 ação por oportunidade, depois RRI, depois causas.
 */

import { DecisionEngine, type RankedOpportunity } from '../decision-engine';
import type { ConfidenceLevel } from '../../contracts/revenue.contracts';
import type { EngineAssessment } from '../../revenue-engine/revenue-engine';

function assessment(partial?: Partial<EngineAssessment>): EngineAssessment {
  return {
    items: [],
    totalRecoverableCents: 0,
    confidence: { pct: 80, level: 'high', reason: 'ok' },
    annualRevenueCents: null,
    ...partial,
  };
}

describe('DecisionEngine.decide — Regra Zero: dinheiro vira decisão', () => {
  it('RED 006: ordena por R$ recuperável (desc) e corta no Top 3', () => {
    const a = assessment({
      items: [
        { externalId: 'low', recoverableCents: 100 },
        { externalId: 'top', recoverableCents: 9_000 },
        { externalId: 'mid', recoverableCents: 3_000 },
        { externalId: 'tiny', recoverableCents: 10 },
      ],
      totalRecoverableCents: 12_110,
    });

    const decision = new DecisionEngine().decide(a);

    // por dinheiro, não por churn/pReturn — e só os 3 maiores
    expect(decision.topOpportunities.map((o) => o.externalId)).toEqual(['top', 'mid', 'low']);
  });

  function decideWithLevel(level: ConfidenceLevel, pct: number): RankedOpportunity {
    const a = assessment({
      items: [{ externalId: 'x', recoverableCents: 5_000 }],
      totalRecoverableCents: 5_000,
      confidence: { pct, level, reason: 'x' },
    });
    return new DecisionEngine().decide(a).topOpportunities[0];
  }

  // Regra Zero (Art. IV): a confiança define QUAL ação, nunca SE existe ação.
  it('RED 007: preliminary (<25%) não executa — manda melhorar dados (Art. VI)', () => {
    const op = decideWithLevel('preliminary', 12);
    expect(op.action.label).toBe('Melhorar dados antes de executar');
    expect(op.action.executable).toBe(false);
  });

  it('RED 007b: low → campanha piloto executável (sempre há próximo passo)', () => {
    const op = decideWithLevel('low', 33);
    expect(op.action.label).toBe('Executar campanha piloto em pequena escala');
    expect(op.action.executable).toBe(true);
  });

  it('RED 007c: medium → campanha de recuperação executável', () => {
    const op = decideWithLevel('medium', 70);
    expect(op.action.label).toBe('Executar campanha de recuperação');
    expect(op.action.executable).toBe(true);
  });

  it('RED 007d: high → recuperação automática (quando permitido), executável', () => {
    const op = decideWithLevel('high', 90);
    expect(op.action.label).toBe('Executar recuperação automaticamente (quando permitido)');
    expect(op.action.executable).toBe(true);
  });

  it('RED 008: RRI operacional é percentil interno 0–100 — maior R$ = 100', () => {
    const a = assessment({
      items: [
        { externalId: 'top', recoverableCents: 9_000 },
        { externalId: 'mid', recoverableCents: 3_000 },
        { externalId: 'low', recoverableCents: 100 },
      ],
      totalRecoverableCents: 12_100,
    });

    const ops = new DecisionEngine().decide(a).topOpportunities;
    const top = ops.find((o) => o.externalId === 'top')!;
    const low = ops.find((o) => o.externalId === 'low')!;

    expect(top.rriOperational).toBe(100);
    expect(low.rriOperational).toBeGreaterThanOrEqual(0);
    expect(low.rriOperational).toBeLessThan(top.rriOperational);
  });

  it('RED 009: RRI executivo = recuperável ÷ receita anual (%); null se anual desconhecida', () => {
    const known = assessment({
      items: [{ externalId: 'x', recoverableCents: 50_000 }],
      totalRecoverableCents: 50_000,
      annualRevenueCents: 1_000_000, // 50.000 / 1.000.000 = 5%
    });
    const unknown = assessment({
      items: [{ externalId: 'x', recoverableCents: 50_000 }],
      totalRecoverableCents: 50_000,
      annualRevenueCents: null,
    });

    expect(new DecisionEngine().decide(known).rriExecutivePct).toBe(5);
    expect(new DecisionEngine().decide(unknown).rriExecutivePct).toBeNull();
  });

  it('RED 010: causas auditáveis somam o total recuperável (segmentos básicos)', () => {
    const a = assessment({
      items: [
        { externalId: 'a', recoverableCents: 9_000 },
        { externalId: 'b', recoverableCents: 3_000 },
        { externalId: 'c', recoverableCents: 1_000 },
        { externalId: 'd', recoverableCents: 500 },
        { externalId: 'e', recoverableCents: 200 },
      ],
      totalRecoverableCents: 13_700,
    });

    const causes = new DecisionEngine().decide(a).causes;

    // Guardrail 5: auditável — as causas reconciliam com o total, sem buraco.
    expect(causes.reduce((s, c) => s + c.recoverableCents, 0)).toBe(13_700);
    expect(Math.round(causes.reduce((s, c) => s + c.pctOfTotal, 0))).toBe(100);
    expect(causes.length).toBeGreaterThanOrEqual(1);
  });
});
