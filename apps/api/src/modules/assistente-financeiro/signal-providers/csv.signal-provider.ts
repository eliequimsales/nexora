/**
 * CsvSignalProvider — o PRIMEIRO Signal Provider (Guardrail 8).
 *
 * RFM é apenas o modelo de sinal deste provider, nunca a regra universal.
 * O Revenue Engine só consome RevenueSignal normalizado.
 *
 * Implementação por micro-TDD: parse → toSignals → validação honesta.
 */

import type {
  AssessmentInput,
  CanonicalCustomer,
  CanonicalPurchase,
  RevenueSignal,
  SignalProvider,
} from '../contracts/revenue.contracts';

export interface CsvProviderConfig {
  orgId: string;
  marginPctDefault: number;
  annualRevenueCents?: number;
  /** injetável para testes determinísticos */
  now?: Date;
}

export class CsvSignalProvider implements SignalProvider {
  readonly id = 'csv';

  constructor(private readonly config: CsvProviderConfig) {}

  async parse(raw: unknown): Promise<AssessmentInput> {
    const lines = String(raw ?? '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== '');
    lines.shift(); // header

    const customers: CanonicalCustomer[] = [];
    const warnings: string[] = [];
    const totalRows = lines.length;

    for (const line of lines) {
      const [id, dateStr, totalStr, nStr] = line.split(',').map((c) => c?.trim());
      const total = Number(totalStr);
      const n = parseInt(nStr, 10);
      const date = new Date(dateStr);

      // Validação honesta: linha inválida não quebra, vira warning e reduz cobertura.
      if (!id || Number.isNaN(total) || Number.isNaN(n) || n <= 0 || Number.isNaN(date.getTime())) {
        warnings.push(`linha ignorada (dado incompleto/inválido): ${line}`);
        continue;
      }

      const amountEach = Math.round((total * 100) / n);
      const purchases: CanonicalPurchase[] = Array.from({ length: n }, () => ({
        at: date,
        amountCents: amountEach,
      }));
      customers.push({
        externalId: id,
        firstPurchaseAt: null,
        lastPurchaseAt: date,
        purchases,
      });
    }

    return {
      schemaVersion: 1,
      orgId: this.config.orgId,
      currency: 'BRL',
      annualRevenueCents: this.config.annualRevenueCents,
      marginPctDefault: this.config.marginPctDefault,
      customers,
      dataQuality: {
        totalRows,
        validRows: customers.length,
        coverage: totalRows === 0 ? 0 : customers.length / totalRows,
        warnings,
      },
    };
  }

  toSignals(input: AssessmentInput): RevenueSignal[] {
    const now = this.config.now ?? new Date();
    return input.customers.map((c) => {
      const F = c.purchases.length;
      const totalCents = c.purchases.reduce((s, p) => s + p.amountCents, 0);
      const M = F > 0 ? totalCents / F : 0; // ticket médio (centavos)
      const R = c.lastPurchaseAt ? daysBetween(c.lastPurchaseAt, now) : Infinity;

      // pReturn = base(F) · decaimento(R)
      const base = 1 - 1 / (1 + F); // mais compras → mais propenso a voltar
      const decay = Math.exp(-R / TAU_DAYS); // mais recente → mais propenso
      const pReturn = clamp01(base * decay);

      // futureValue recorrente (não ticket único).
      // NOTA: estimativa de recorrência é mínima e crua (CSV não traz firstPurchaseAt);
      // será recalibrada pelo Learning Engine. Saturante para não superestimar.
      const expectedReturns = 1 + Math.log1p(F) * 0.5;
      const futureValueCents = Math.round(M * expectedReturns * input.marginPctDefault);

      return {
        externalId: c.externalId,
        pReturn,
        futureValueCents,
        recoveryCostCents: RECOVERY_COST_CENTS,
      };
    });
  }
}

const TAU_DAYS = 60; // meia-vida do decaimento de recência (default por nicho)
const RECOVERY_COST_CENTS = 0; // MVP: custo de abordagem assumido ~0; refinar depois

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / 86_400_000);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
