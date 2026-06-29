/**
 * runCustomerRecoveryAssessment — determinismo (Art. VI: verdade reprodutível).
 *
 * A recência depende de "hoje". Sem `now` injetável, o resultado mudaria com o
 * relógio real e o teste seria frágil. `now` torna a avaliação determinística.
 */

import { runCustomerRecoveryAssessment } from '../customer-recovery-assessment';

const CSV = `customer_id,last_purchase_date,total_amount,n_purchases
c1,2026-01-10,1000.00,5
c2,2026-03-15,2000.00,8`;

describe('runCustomerRecoveryAssessment — now injetável', () => {
  it('RED 015: now injetado torna o resultado determinístico (independe da data real)', async () => {
    const opts = { orgId: 'o', marginPctDefault: 0.6, now: new Date('2026-06-28T00:00:00Z') };

    const r1 = await runCustomerRecoveryAssessment(CSV, opts);
    const r2 = await runCustomerRecoveryAssessment(CSV, opts);
    expect(r1.totalRecoverableCents).toBe(r2.totalRecoverableCents);

    // data mais distante da última compra → menos recuperável (recência cai)
    const future = await runCustomerRecoveryAssessment(CSV, {
      ...opts,
      now: new Date('2027-06-28T00:00:00Z'),
    });
    expect(future.totalRecoverableCents).toBeLessThan(r1.totalRecoverableCents);
  });

  it('RED 013c: a saída do produto expõe a faixa low/high do valor potencial', async () => {
    const r = await runCustomerRecoveryAssessment(CSV, {
      orgId: 'o',
      marginPctDefault: 0.6,
      now: new Date('2026-06-28T00:00:00Z'),
    });

    expect(r.rangeLowCents).toBeLessThanOrEqual(r.totalRecoverableCents);
    expect(r.rangeHighCents).toBeGreaterThanOrEqual(r.totalRecoverableCents);
  });
});
