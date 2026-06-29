/**
 * TESTE DE VALOR (BDD) — o primeiro e mais importante teste da Nexora.
 *
 * Ele NÃO valida uma fórmula. Valida a PROMESSA da empresa (SUCCESS.md):
 * dado um CSV de clientes, o sistema entrega dinheiro recuperável + Top 3
 * oportunidades + 1 ação cada + confiança honesta + ação executável.
 *
 * Deve FALHAR até a experiência completa existir. Depois é quebrado em testes
 * menores (Provider, Customer Recovery Engine, Decision) — a ordem de implementação.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runCustomerRecoveryAssessment } from '../customer-recovery-assessment';

// fixtures/ ficam na raiz do repo (datasets canônicos compartilhados por todos os testes)
const SHOPIFY_FIXTURE = resolve(
  __dirname,
  '../../../../../../../fixtures/shopify-sample.csv',
);

describe('TESTE DE VALOR (BDD) — a promessa da Nexora', () => {
  it('CSV de clientes → R$ recuperável + Top 3 + 1 ação cada + confiança + ação executável', async () => {
    const csv = readFileSync(SHOPIFY_FIXTURE, 'utf-8');

    const result = await runCustomerRecoveryAssessment(csv, {
      orgId: 'org_test',
      annualRevenueCents: 100_000_00, // R$ 100.000
      marginPctDefault: 0.6,
      now: new Date('2026-06-28T00:00:00Z'), // determinístico: não depende do relógio real
    });

    // Artigo X — existe dinheiro recuperável, positivo
    expect(result.totalRecoverableCents).toBeGreaterThan(0);

    // Decision Engine — Top 3, ordenadas por R$ desc (dinheiro, não score)
    expect(result.topOpportunities.length).toBeGreaterThan(0);
    expect(result.topOpportunities.length).toBeLessThanOrEqual(3);
    const values = result.topOpportunities.map((o) => o.recoverableCents);
    expect(values).toEqual([...values].sort((a, b) => b - a));

    // Regra Zero — toda oportunidade termina em EXATAMENTE uma ação
    for (const opp of result.topOpportunities) {
      expect(opp.action).toBeDefined();
      expect(opp.action.label).toBeTruthy();
    }

    // Termina em ação, não em relatório — pelo menos uma executável
    expect(result.topOpportunities.some((o) => o.action.executable)).toBe(true);

    // Artigo VI — confiança sempre presente e explicada
    expect(result.confidence.pct).toBeGreaterThanOrEqual(0);
    expect(result.confidence.pct).toBeLessThanOrEqual(100);
    expect(result.confidence.reason).toBeTruthy();

    // Guardrail 5 — causas auditáveis
    expect(result.causes.length).toBeGreaterThan(0);
  });
});
