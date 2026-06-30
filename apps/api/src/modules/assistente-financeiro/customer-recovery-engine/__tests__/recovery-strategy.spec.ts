/**
 * buildStrategy — o CÉREBRO: decide a abordagem por cliente a partir do RFM.
 * Determinístico, com o porquê. Não inventa contexto (Art. VI).
 */

import { buildStrategy } from '../recovery-strategy';

describe('buildStrategy — estratégia por cliente (RFM)', () => {
  it('RED 019: alta chance (recente/frequente) → lembrete, SEM desconto', () => {
    const s = buildStrategy({ recencyMonths: 3, frequency: 8, avgTicketCents: 30_000, pReturn: 0.6 });
    expect(s.offerDiscount).toBe(false);
    expect(s.approach.toLowerCase()).toMatch(/lembrete|convite/);
    expect(s.reason.length).toBeGreaterThan(0);
    expect(s.recommendations.length).toBeGreaterThan(0);
  });

  it('RED 019b: alto valor + já voltou antes → convite cordial, SEM desconto (não queima margem)', () => {
    const s = buildStrategy({ recencyMonths: 12, frequency: 4, avgTicketCents: 180_000, pReturn: 0.25 });
    expect(s.offerDiscount).toBe(false);
    expect(s.reason.toLowerCase()).toMatch(/valor|margem|sozinho|espontâne/);
  });

  it('RED 019c: ausência longa + baixo histórico/valor → incentivo (avaliação/desconto)', () => {
    const s = buildStrategy({ recencyMonths: 20, frequency: 1, avgTicketCents: 6_000, pReturn: 0.08 });
    expect(s.offerDiscount).toBe(true);
    expect(s.approach.toLowerCase()).toMatch(/incentivo|avalia|oferta|desconto/);
  });
});
