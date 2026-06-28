/**
 * RevenueEngine — o MOTOR UNIVERSAL (Constituição, Artigo VII).
 *
 * Só consome RevenueSignal normalizado: nunca conhece setor, RFM, recência crua.
 * Artigo X (Dinheiro antes de vaidade): a saída primária é R$ recuperável.
 *
 * TDD vermelho→verde, uma conta por vez.
 */

import { RevenueEngine } from '../revenue-engine';
import type {
  AssessmentInput,
  DataQuality,
  RevenueSignal,
} from '../../contracts/revenue.contracts';

function makeInput(partial?: Partial<AssessmentInput>): AssessmentInput {
  return {
    schemaVersion: 1,
    orgId: 'org_test',
    currency: 'BRL',
    marginPctDefault: 0.3,
    customers: [],
    ...partial,
  };
}

function dq(coverage: number, totalRows = 100): DataQuality {
  const validRows = Math.round(coverage * totalRows);
  return { totalRows, validRows, coverage, warnings: [] };
}

function makeSignals(n: number): RevenueSignal[] {
  return Array.from({ length: n }, (_, i) => ({
    externalId: `s${i}`,
    pReturn: 0.4,
    futureValueCents: 10_000,
    recoveryCostCents: 0,
  }));
}

describe('RevenueEngine.assess — a conta que vira R$ (Artigo X)', () => {
  it('RED 004: recuperável por cliente = pReturn × futureValue − custo; total = soma', () => {
    const signals: RevenueSignal[] = [
      { externalId: 'a', pReturn: 0.5, futureValueCents: 10_000, recoveryCostCents: 1_000 },
      { externalId: 'b', pReturn: 0.2, futureValueCents: 50_000, recoveryCostCents: 0 },
    ];

    const result = new RevenueEngine().assess(signals, makeInput());

    // a: 0.5 × 10000 − 1000 = 4000 ; b: 0.2 × 50000 − 0 = 10000
    const a = result.items.find((i) => i.externalId === 'a')!;
    const b = result.items.find((i) => i.externalId === 'b')!;
    expect(a.recoverableCents).toBe(4_000);
    expect(b.recoverableCents).toBe(10_000);
    expect(result.totalRecoverableCents).toBe(14_000);
  });

  it('RED 004b: recuperável nunca é negativo — custo > ganho esperado vira oportunidade zero', () => {
    const signals: RevenueSignal[] = [
      // ganho esperado 0.1 × 5000 = 500 ; custo 2000 → conta daria −1500
      { externalId: 'c', pReturn: 0.1, futureValueCents: 5_000, recoveryCostCents: 2_000 },
    ];

    const result = new RevenueEngine().assess(signals, makeInput());

    expect(result.items[0].recoverableCents).toBe(0);
    expect(result.totalRecoverableCents).toBe(0);
  });

  it('RED 005: confiança cai quando a cobertura cai (mesma amostra) — Artigo VI', () => {
    const signals = makeSignals(100); // volume idêntico nos dois cenários

    const hi = new RevenueEngine().assess(signals, makeInput({ dataQuality: dq(1.0) }));
    const lo = new RevenueEngine().assess(signals, makeInput({ dataQuality: dq(0.3) }));

    expect(lo.confidence.pct).toBeLessThan(hi.confidence.pct);
    // honestidade explícita: a confiança diz POR QUE é o que é
    expect(lo.confidence.reason.length).toBeGreaterThan(0);
  });

  it('RED 005b: amostra pequena nunca dá alta confiança, mesmo com 100% de cobertura', () => {
    const tiny = new RevenueEngine().assess(makeSignals(3), makeInput({ dataQuality: dq(1.0) }));

    expect(tiny.confidence.level).not.toBe('high');
    expect(tiny.confidence.pct).toBeLessThan(25);
  });
});
