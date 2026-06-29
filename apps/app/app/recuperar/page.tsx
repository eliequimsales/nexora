'use client';

/**
 * Recuperação de clientes — a primeira tela do produto (MVP clínica).
 *
 * Fluxo (Regra Zero, money-first): sobe CSV → vê clientes recuperáveis + valor
 * potencial → vê Top 3 → clica em uma ação. Consome POST /customer-recovery/assessment.
 */

import { useState } from 'react';
import { Upload, TrendingUp, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface RecoveryAction {
  kind: string;
  label: string;
  executable: boolean;
  riskCopy: string;
}
interface RecoveryOpportunity {
  externalId: string;
  recoverableCents: number;
  rriOperational: number;
  action: RecoveryAction;
  why: string;
}
interface Assessment {
  recoverableCount: number;
  totalRecoverableCents: number;
  rangeLowCents: number;
  rangeHighCents: number;
  confidence: { pct: number; level: string; reason: string };
  rriExecutivePct: number | null;
  topOpportunities: RecoveryOpportunity[];
  causes: { label: string; recoverableCents: number; pctOfTotal: number }[];
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function RecuperarPage() {
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Assessment | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsv(await file.text());
    setResult(null);
    setError('');
  }

  async function analisar() {
    if (!csv) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/customer-recovery/assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, marginPctDefault: 0.6 }),
      });
      if (!res.ok) throw new Error(`Falha ao analisar (${res.status})`);
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao analisar o CSV.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-brand-bg text-text-primary px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold">Recuperação de clientes</h1>
          <p className="mt-1 text-text-secondary">
            Suba o CSV dos seus clientes e veja quem vale a pena trazer de volta — e quanto isso vale.
          </p>
        </header>

        {/* Upload */}
        <section className="rounded-xl border border-brand-border bg-brand-surface-2 p-5">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-brand-border-2 px-4 py-8 text-center hover:bg-brand-surface-3">
            <Upload className="h-6 w-6 text-brand-amber" />
            <span className="text-sm">
              {fileName || 'Selecionar arquivo CSV'}
            </span>
            <span className="text-xs text-text-secondary">
              colunas: customer_id, last_purchase_date, total_amount, n_purchases
            </span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>

          <div className="mt-4 flex items-center gap-3">
            <Button variant="primary" size="lg" onClick={analisar} loading={loading} disabled={!csv}>
              Analisar <ArrowRight className="h-4 w-4" />
            </Button>
            {error && <span className="text-sm text-status-error">{error}</span>}
          </div>
        </section>

        {/* Resultado money-first */}
        {result && (
          <section className="mt-8 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-brand-border bg-brand-surface-2 p-5">
                <p className="text-sm text-text-secondary">Clientes recuperáveis</p>
                <p className="mt-1 text-4xl font-bold">{result.recoverableCount}</p>
              </div>
              <div className="rounded-xl border border-brand-amber/40 bg-brand-surface-2 p-5">
                <p className="text-sm text-text-secondary">Valor potencial</p>
                <p className="mt-1 text-4xl font-bold text-brand-amber">
                  {brl(result.totalRecoverableCents)}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  faixa {brl(result.rangeLowCents)} – {brl(result.rangeHighCents)}
                </p>
              </div>
            </div>

            {/* Confiança honesta (Art. VI) */}
            <div className="flex items-start gap-2 rounded-lg border border-brand-border bg-brand-surface px-4 py-3 text-sm text-text-secondary">
              <TrendingUp className="mt-0.5 h-4 w-4 text-brand-amber shrink-0" />
              <span>
                Confiança {result.confidence.pct}% ({result.confidence.level}) — {result.confidence.reason}
              </span>
            </div>

            {/* Top 3 */}
            <div>
              <h2 className="mb-3 text-lg font-semibold">Recupere primeiro estes</h2>
              <ul className="space-y-3">
                {result.topOpportunities.map((op) => (
                  <li
                    key={op.externalId}
                    className="rounded-xl border border-brand-border bg-brand-surface-2 p-4"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">Cliente {op.externalId}</span>
                      <span className="text-lg font-bold text-brand-amber">
                        {brl(op.recoverableCents)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">{op.why}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Button
                        variant={op.action.executable ? 'primary' : 'outline'}
                        size="md"
                        disabled={!op.action.executable || done[op.externalId]}
                        onClick={() => setDone((d) => ({ ...d, [op.externalId]: true }))}
                      >
                        {done[op.externalId] ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" /> Ação iniciada
                          </>
                        ) : (
                          op.action.label
                        )}
                      </Button>
                      <span className="flex items-center gap-1 text-xs text-text-secondary">
                        {!op.action.executable && <AlertTriangle className="h-3.5 w-3.5" />}
                        {op.action.riskCopy}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
