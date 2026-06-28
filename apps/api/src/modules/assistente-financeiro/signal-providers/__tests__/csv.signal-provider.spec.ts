import { CsvSignalProvider } from '../csv.signal-provider';

const CLEAN_CSV = `customer_id,last_purchase_date,total_amount,n_purchases
c001,2026-06-10,2400.00,12
c002,2026-05-28,4000.00,1
c003,2026-01-15,1800.00,9`;

function makeProvider() {
  return new CsvSignalProvider({
    orgId: 'org_test',
    marginPctDefault: 0.6,
    annualRevenueCents: 100_000_00,
    now: new Date('2026-06-28T00:00:00Z'),
  });
}

describe('CsvSignalProvider', () => {
  // ---------- TESTE 001 — parse: CSV válido vira Customer normalizado ----------
  describe('parse — CSV válido → schema canônico', () => {
    it('normaliza 3 clientes com id, data, e compras sintetizadas do agregado', async () => {
      const input = await makeProvider().parse(CLEAN_CSV);

      expect(input.customers).toHaveLength(3);

      const c001 = input.customers[0];
      expect(c001.externalId).toBe('c001');
      expect(c001.lastPurchaseAt).toBeInstanceOf(Date);
      expect(Number.isNaN(c001.lastPurchaseAt!.getTime())).toBe(false);

      // n_purchases=12 → 12 compras sintéticas; total 2400.00 → 240000 centavos
      expect(c001.purchases).toHaveLength(12);
      const sum = c001.purchases.reduce((s, p) => s + p.amountCents, 0);
      expect(sum).toBe(240000);

      // cobertura total para dado limpo
      expect(input.dataQuality?.coverage).toBe(1);
      expect(input.dataQuality?.warnings).toHaveLength(0);
    });
  });

  // ---------- TESTE 002 — toSignals: RFM → pReturn + futureValue ----------
  describe('toSignals — RFM produz sinais normalizados', () => {
    it('gera pReturn em (0,1) e futureValue > 0 para cada cliente', async () => {
      const provider = makeProvider();
      const input = await provider.parse(CLEAN_CSV);
      const signals = provider.toSignals(input);

      expect(signals).toHaveLength(3);
      for (const s of signals) {
        expect(s.pReturn).toBeGreaterThan(0);
        expect(s.pReturn).toBeLessThan(1);
        expect(s.futureValueCents).toBeGreaterThan(0);
      }
    });

    it('cliente recente e frequente tem pReturn maior que antigo e raro', async () => {
      const provider = makeProvider();
      const input = await provider.parse(CLEAN_CSV);
      const signals = provider.toSignals(input);

      const c001 = signals.find((s) => s.externalId === 'c001')!; // 2026-06-10, F=12
      const c003 = signals.find((s) => s.externalId === 'c003')!; // 2026-01-15, F=9
      expect(c001.pReturn).toBeGreaterThan(c003.pReturn);
    });
  });

  // ---------- TESTE 003 — validação honesta: dado sujo reduz cobertura, não quebra ----------
  describe('parse — dado sujo não quebra e reduz a cobertura', () => {
    const DIRTY_CSV = `customer_id,last_purchase_date,total_amount,n_purchases
c001,2026-06-10,2400.00,12
,2026-05-28,4000.00,1
c003,not-a-date,1800.00,9
c004,2026-01-15,abc,3
c005,2026-02-01,500.00,0`;

    it('não lança, mantém só as linhas válidas e registra warnings + coverage < 1', async () => {
      const input = await makeProvider().parse(DIRTY_CSV);

      // só c001 é válida (4 linhas sujas: sem id, data ruim, valor ruim, n=0)
      expect(input.customers).toHaveLength(1);
      expect(input.customers[0].externalId).toBe('c001');

      expect(input.dataQuality?.totalRows).toBe(5);
      expect(input.dataQuality?.validRows).toBe(1);
      expect(input.dataQuality?.coverage).toBeCloseTo(0.2, 5);
      expect(input.dataQuality?.warnings).toHaveLength(4);
    });
  });
});
