'use client';

/**
 * RecoveryAnalyzer — o CORAÇÃO do produto (Engine Universal money-first).
 *
 * Sobe CSV → POST /customer-recovery/assessment → clientes recuperáveis, valor
 * potencial (faixa), confiança honesta, Top 3 e a ação por cliente. Usado tanto
 * na demo pública quanto dentro da conta da clínica (uma experiência só).
 */

import { useState } from 'react';
import { Upload, TrendingUp, CheckCircle2, AlertTriangle, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { track } from '@/lib/analytics/track';

const PRICE_BANDS: { value: string; label: string }[] = [
  { value: 'ate_49', label: 'Até R$ 49/mês' },
  { value: 'ate_99', label: 'Até R$ 99/mês' },
  { value: 'ate_149', label: 'Até R$ 149/mês' },
  { value: 'mais_149', label: 'Mais de R$ 149/mês' },
  { value: 'nao_pagaria', label: 'Ainda não pagaria' },
];

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

export function RecoveryAnalyzer({ orgSlug }: { orgSlug?: string } = {}) {
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Assessment | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});

  // Feedback (Etapa 2 — aprendizado do piloto)
  const [rating, setRating] = useState(0);
  const [wouldUseAgain, setWouldUseAgain] = useState<boolean | null>(null);
  const [wouldPay, setWouldPay] = useState<boolean | null>(null);
  const [priceBand, setPriceBand] = useState('');
  const [whatMissing, setWhatMissing] = useState('');
  const [fbSent, setFbSent] = useState(false);
  const [fbLoading, setFbLoading] = useState(false);

  async function enviarFeedback() {
    if (!rating || !priceBand || wouldUseAgain === null || wouldPay === null) return;
    setFbLoading(true);
    try {
      await fetch('/api/v1/customer-recovery/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          wouldUseAgain,
          wouldPay,
          priceBand,
          whatMissing: whatMissing || undefined,
          orgSlug,
          recoverableCount: result?.recoverableCount,
          totalRecoverableCents: result?.totalRecoverableCents,
          confidencePct: result?.confidence.pct,
        }),
      });
      track('feedback', orgSlug);
      setFbSent(true);
    } finally {
      setFbLoading(false);
    }
  }

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
    track('analyze', orgSlug);
    try {
      const res = await fetch('/api/v1/customer-recovery/assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, marginPctDefault: 0.6 }),
      });
      if (!res.ok) throw new Error(`Falha ao analisar (${res.status})`);
      setResult(await res.json());
      track('result', orgSlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao analisar o CSV.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload */}
      <section className="rounded-xl border border-brand-border bg-brand-surface-2 p-5">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-brand-border-2 px-4 py-8 text-center hover:bg-brand-surface-3">
          <Upload className="h-6 w-6 text-brand-amber" />
          <span className="text-sm">{fileName || 'Arraste seu CSV ou clique para escolher'}</span>
          <span className="text-xs text-text-secondary">
            colunas: customer_id, last_purchase_date, total_amount, n_purchases
          </span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </label>

        <div className="mt-4 flex items-center gap-3">
          <Button variant="primary" size="lg" onClick={analisar} loading={loading} disabled={!csv}>
            Analisar
          </Button>
          {error && <span className="text-sm text-status-error">{error}</span>}
        </div>
      </section>

      {/* Resultado money-first */}
      {result && (
        <section className="space-y-6">
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

          <div className="flex items-start gap-2 rounded-lg border border-brand-border bg-brand-surface px-4 py-3 text-sm text-text-secondary">
            <TrendingUp className="mt-0.5 h-4 w-4 text-brand-amber shrink-0" />
            <span>
              Confiança {result.confidence.pct}% ({result.confidence.level}) — {result.confidence.reason}
            </span>
          </div>

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

          {/* Feedback — o aprendizado do piloto */}
          <div className="rounded-xl border border-brand-border bg-brand-surface-2 p-5">
            {fbSent ? (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <CheckCircle2 className="h-5 w-5 text-status-success shrink-0" />
                Obrigado! Seu feedback foi registrado e vai ajudar a construir a Nexora. 🙏
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Como foi sua experiência?</h2>

                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setRating(n)} aria-label={`${n} estrelas`} className="p-0.5">
                      <Star
                        size={26}
                        className={n <= rating ? 'fill-brand-amber text-brand-amber' : 'text-text-muted'}
                      />
                    </button>
                  ))}
                </div>

                <YesNo label="Você usaria novamente?" value={wouldUseAgain} onChange={setWouldUseAgain} />
                <YesNo label="Você pagaria por isso?" value={wouldPay} onChange={setWouldPay} />

                <div>
                  <p className="mb-2 text-sm text-text-secondary">Quanto faria sentido pagar?</p>
                  <div className="flex flex-wrap gap-2">
                    {PRICE_BANDS.map((b) => (
                      <button
                        key={b.value}
                        onClick={() => setPriceBand(b.value)}
                        className={`rounded-lg border px-3 py-1.5 text-xs ${
                          priceBand === b.value
                            ? 'border-brand-amber bg-brand-amber/10 text-brand-amber'
                            : 'border-brand-border text-text-secondary hover:border-brand-border-2'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={whatMissing}
                  onChange={(e) => setWhatMissing(e.target.value)}
                  placeholder="O que faltou? O que ficou confuso? (opcional)"
                  rows={3}
                  className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-amber/60 focus:outline-none"
                />

                <Button
                  variant="primary"
                  onClick={enviarFeedback}
                  loading={fbLoading}
                  disabled={!rating || !priceBand || wouldUseAgain === null || wouldPay === null}
                >
                  Enviar feedback
                </Button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="flex gap-2">
        {[
          { v: true, l: 'Sim' },
          { v: false, l: 'Não' },
        ].map(({ v, l }) => (
          <button
            key={l}
            onClick={() => onChange(v)}
            className={`rounded-lg border px-3 py-1.5 text-xs ${
              value === v
                ? 'border-brand-amber bg-brand-amber/10 text-brand-amber'
                : 'border-brand-border text-text-secondary hover:border-brand-border-2'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
