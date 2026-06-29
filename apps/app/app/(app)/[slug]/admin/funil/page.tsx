'use client';

/**
 * Funil do piloto — a "planilha simples" pra acompanhar todo dia.
 * landing → cta → signup → analyze → result → feedback (últimos 30 dias).
 */

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';

const STEPS: { name: string; label: string }[] = [
  { name: 'landing_view', label: 'Visitaram a landing' },
  { name: 'cta_pilot', label: 'Chegaram ao cadastro' },
  { name: 'signup', label: 'Criaram conta' },
  { name: 'analyze', label: 'Subiram CSV (analisaram)' },
  { name: 'result', label: 'Viram o resultado' },
  { name: 'feedback', label: 'Enviaram feedback' },
];

export default function FunilPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get<{ name: string; count: number }[]>('/customer-recovery/funnel')
      .then((res) => {
        const map: Record<string, number> = {};
        for (const row of res.data) map[row.name] = row.count;
        setCounts(map);
      })
      .catch(() => setError('Não foi possível carregar o funil.'))
      .finally(() => setLoading(false));
  }, []);

  const top = counts[STEPS[0].name] || 0;

  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Funil do piloto</h1>
        <p className="mt-1 text-text-secondary">Últimos 30 dias. Onde a clínica trava.</p>
      </header>

      {loading && <p className="text-text-muted">Carregando…</p>}
      {error && <p className="text-status-error">{error}</p>}

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-brand-border">
          <table className="w-full text-sm">
            <thead className="bg-brand-surface-2 text-text-secondary">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Etapa</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium">% da landing</th>
              </tr>
            </thead>
            <tbody>
              {STEPS.map((s) => {
                const c = counts[s.name] || 0;
                const pct = top > 0 ? Math.round((c / top) * 100) : 0;
                return (
                  <tr key={s.name} className="border-t border-brand-border">
                    <td className="px-4 py-2.5 text-text-primary">{s.label}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-text-primary">{c}</td>
                    <td className="px-4 py-2.5 text-right text-text-secondary">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
