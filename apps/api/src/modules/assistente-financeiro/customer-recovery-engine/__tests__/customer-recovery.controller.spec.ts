/**
 * CustomerRecoveryController — a porta do produto.
 * - POST /customer-recovery/assessment: CSV → assessment money-first.
 * - POST /customer-recovery/feedback: captura o aprendizado do piloto no Postgres.
 */

import { CustomerRecoveryController } from '../customer-recovery.controller';

const CSV = `customer_id,last_purchase_date,total_amount,n_purchases
c1,2026-01-10,1000.00,5
c2,2026-03-15,2000.00,8
c3,2026-05-01,500.00,2`;

// Prisma fake — assessment não usa; feedback usa create.
function fakePrisma() {
  return { customerRecoveryFeedback: { create: jest.fn().mockResolvedValue({ id: 'fb_1' }) } };
}

describe('CustomerRecoveryController', () => {
  it('RED 016: assessment recebe CSV e retorna money-first (R$, Top 3, faixa, confiança)', async () => {
    const controller = new CustomerRecoveryController(fakePrisma() as never);

    const res = await controller.assess({ csv: CSV, marginPctDefault: 0.6 } as never);

    expect(res.totalRecoverableCents).toBeGreaterThan(0);
    expect(res.topOpportunities.length).toBeGreaterThan(0);
    expect(res.topOpportunities[0].action.label).toBeTruthy();
    expect(res.rangeLowCents).toBeLessThanOrEqual(res.totalRecoverableCents);
    expect(res.confidence.reason).toBeTruthy();
  });

  it('RED 018: feedback grava no Postgres e devolve ok', async () => {
    const prisma = fakePrisma();
    const controller = new CustomerRecoveryController(prisma as never);

    const res = await controller.feedback({
      rating: 5,
      wouldUseAgain: true,
      wouldPay: true,
      priceBand: 'ate_99',
      whatMissing: 'WhatsApp automático',
      orgSlug: 'clinica-x',
      recoverableCount: 47,
      totalRecoverableCents: 8_240_000,
      confidencePct: 78,
    } as never);

    expect(res).toEqual({ ok: true });
    expect(prisma.customerRecoveryFeedback.create).toHaveBeenCalledTimes(1);
    const arg = prisma.customerRecoveryFeedback.create.mock.calls[0][0];
    expect(arg.data.rating).toBe(5);
    expect(arg.data.priceBand).toBe('ate_99');
    expect(arg.data.wouldPay).toBe(true);
  });
});
