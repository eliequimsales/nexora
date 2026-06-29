/**
 * CustomerRecoveryController — a porta do produto (POST /customer-recovery/assessment).
 *
 * Recebe o CSV do dono da clínica e devolve o CustomerRecoveryAssessment money-first.
 * Endpoint público, stateless: processa o CSV e retorna a análise; nada é persistido.
 */

import { CustomerRecoveryController } from '../customer-recovery.controller';

const CSV = `customer_id,last_purchase_date,total_amount,n_purchases
c1,2026-01-10,1000.00,5
c2,2026-03-15,2000.00,8
c3,2026-05-01,500.00,2`;

describe('CustomerRecoveryController — POST /customer-recovery/assessment', () => {
  it('RED 016: recebe CSV e retorna o assessment money-first (R$, Top 3, faixa, confiança)', async () => {
    const controller = new CustomerRecoveryController();

    const res = await controller.assess({ csv: CSV, marginPctDefault: 0.6 } as never);

    expect(res.totalRecoverableCents).toBeGreaterThan(0);
    expect(res.topOpportunities.length).toBeGreaterThan(0);
    expect(res.topOpportunities[0].action.label).toBeTruthy();
    expect(res.rangeLowCents).toBeLessThanOrEqual(res.totalRecoverableCents);
    expect(res.rangeHighCents).toBeGreaterThanOrEqual(res.totalRecoverableCents);
    expect(res.confidence.reason).toBeTruthy();
  });
});
