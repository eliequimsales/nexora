'use client';

/**
 * Calculadora de receita parada — o momento de auto-descoberta da landing.
 *
 * O visitante coloca os números DELE e vê o próprio prejuízo. Nada é
 * inventado: a conta aparece na tela e a única estimativa (o % da base que
 * está parada) é ajustável por ele.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, TrendingDown } from 'lucide-react';

const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** Fatia da base que costuma estar parada. Padrão conservador, ajustável. */
const SHARES = [
  { label: '20%', value: 0.2 },
  { label: '30%', value: 0.3 },
  { label: '40%', value: 0.4 },
];

/** Quanto dela dá pra trazer de volta com contato ativo. Deliberadamente baixo. */
const RECOVERY_RATE = 0.1;

function clampNumber(raw: string, max: number): number {
  const n = Number(raw.replace(/\D/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

/** Chave do repasse landing → cadastro. Fica na sessão, não na URL. */
export const HANDOFF_KEY = 'nexora.calc';

export function RecoveryCalculator() {
  const [clients, setClients] = useState(400);
  const [ticket, setTicket] = useState(150);
  const [share, setShare] = useState(0.3);

  const { inactive, parked, recoverable } = useMemo(() => {
    const inactiveCount = Math.round(clients * share);
    const parkedValue = inactiveCount * ticket;
    return {
      inactive: inactiveCount,
      parked: parkedValue,
      recoverable: Math.round(parkedValue * RECOVERY_RATE),
    };
  }, [clients, ticket, share]);

  /**
   * Leva o resultado para o cadastro. O cara viu um número aqui — a próxima
   * tela precisa continuar a mesma conversa, senão a promessa se perde.
   */
  function handoff() {
    try {
      window.sessionStorage.setItem(
        HANDOFF_KEY,
        JSON.stringify({ parked, inactive, ts: Date.now() }),
      );
    } catch {
      // Sem sessionStorage o cadastro só não personaliza. Não quebra nada.
    }
  }

  return (
    <div className="rounded-2xl border border-brand-gold/30 bg-brand-surface p-6 shadow-2xl sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        {/* Entradas */}
        <div className="space-y-6">
          <div>
            <label
              htmlFor="calc-clients"
              className="block text-sm font-medium text-text-secondary"
            >
              Quantos clientes já passaram pelo seu negócio?
            </label>
            <input
              id="calc-clients"
              inputMode="numeric"
              value={clients === 0 ? '' : String(clients)}
              onChange={(e) => setClients(clampNumber(e.target.value, 1_000_000))}
              className="mt-2 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-4 py-3 text-2xl font-bold text-text-primary outline-none transition-colors focus:border-brand-gold/60 focus:ring-2 focus:ring-brand-gold/15"
              placeholder="400"
            />
          </div>

          <div>
            <label
              htmlFor="calc-ticket"
              className="block text-sm font-medium text-text-secondary"
            >
              Quanto um cliente gasta, em média, por compra? (R$)
            </label>
            <input
              id="calc-ticket"
              inputMode="numeric"
              value={ticket === 0 ? '' : String(ticket)}
              onChange={(e) => setTicket(clampNumber(e.target.value, 1_000_000))}
              className="mt-2 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-4 py-3 text-2xl font-bold text-text-primary outline-none transition-colors focus:border-brand-gold/60 focus:ring-2 focus:ring-brand-gold/15"
              placeholder="150"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-text-secondary">
              Quanto da sua base você acha que está parada?
            </p>
            <div className="mt-2 flex gap-2">
              {SHARES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setShare(s.value)}
                  aria-pressed={share === s.value}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-all active:scale-[0.98] ${
                    share === s.value
                      ? 'border-brand-gold/50 bg-brand-gold/15 text-brand-gold'
                      : 'border-brand-border bg-brand-surface-2 text-text-secondary hover:bg-brand-surface-3'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-muted">
              Não sabe? Deixe em 30% — é o que costuma aparecer quando alguém olha a
              base pela primeira vez.
            </p>
          </div>
        </div>

        {/* Resultado */}
        <div className="flex flex-col justify-center rounded-xl border border-brand-border bg-brand-bg/60 p-6">
          <div className="flex items-center gap-2">
            <TrendingDown size={15} className="text-status-error" />
            <p className="text-2xs font-semibold uppercase tracking-widest text-status-error">
              Parado na sua base agora
            </p>
          </div>

          <p className="mt-2 text-5xl font-bold leading-none tracking-tight text-text-primary">
            {BRL(parked)}
          </p>
          <p className="mt-2 text-sm text-text-muted">
            {inactive.toLocaleString('pt-BR')} clientes que já compraram de você e pararam.
          </p>

          <div className="mt-6 border-t border-brand-border pt-5">
            <p className="text-2xs font-semibold uppercase tracking-widest text-status-success">
              Se você recuperar só 1 em cada 10
            </p>
            <p className="mt-1 text-3xl font-bold text-status-success">{BRL(recoverable)}</p>
            <p className="mt-1 text-xs text-text-muted">
              De clientes que você <strong className="text-text-secondary">já</strong>{' '}
              conquistou. Sem gastar um centavo em anúncio.
            </p>
          </div>

          <Link
            href="/register"
            onClick={handoff}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gold px-5 py-3.5 font-semibold text-brand-bg shadow-glow-amber-sm transition-all hover:bg-brand-gold/90 active:scale-[0.98]"
          >
            Ver quais clientes são esses
            <ArrowRight size={16} />
          </Link>
          <p className="mt-2 text-center text-2xs text-text-muted">
            Grátis. Sem cartão. Você vê a lista antes de decidir qualquer coisa.
          </p>
        </div>
      </div>

      <p className="mt-6 border-t border-brand-border pt-4 text-center text-xs leading-relaxed text-text-muted">
        A conta é simples e está à vista:{' '}
        <strong className="text-text-secondary">
          {inactive.toLocaleString('pt-BR')} clientes × {BRL(ticket)}
        </strong>{' '}
        = {BRL(parked)}. Estimativa para você dimensionar o problema — dentro da Nexora,
        o cálculo usa a sua lista real, cliente por cliente.
      </p>
    </div>
  );
}
