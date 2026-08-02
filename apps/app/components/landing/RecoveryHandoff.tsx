'use client';

/**
 * Continuidade landing → cadastro.
 *
 * Quem calculou o valor na home chega aqui tendo visto um número. Repetir esse
 * número na tela de cadastro mantém a mesma conversa — é onde o funil costuma
 * perder gente, porque a promessa some no meio do caminho.
 *
 * Silencioso se o visitante não passou pela calculadora.
 */

import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { HANDOFF_KEY } from './RecoveryCalculator';

const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** Vale por uma sessão curta — depois disso o número já não diz respeito. */
const MAX_AGE_MS = 60 * 60 * 1000;

export function RecoveryHandoff() {
  const [data, setData] = useState<{ parked: number; inactive: number } | null>(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(HANDOFF_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        parked: number;
        inactive: number;
        ts: number;
      }>;
      if (
        typeof parsed?.parked !== 'number' ||
        typeof parsed?.inactive !== 'number' ||
        parsed.parked <= 0 ||
        typeof parsed?.ts !== 'number' ||
        Date.now() - parsed.ts > MAX_AGE_MS
      ) {
        return;
      }
      setData({ parked: parsed.parked, inactive: parsed.inactive });
    } catch {
      // JSON inválido ou storage bloqueado — segue sem personalizar.
    }
  }, []);

  if (!data) return null;

  return (
    <div className="mb-5 rounded-xl border border-status-success/30 bg-status-success-muted/15 p-4">
      <div className="flex items-start gap-3">
        <TrendingUp size={16} className="mt-0.5 shrink-0 text-status-success" />
        <div>
          <p className="text-sm font-semibold text-text-primary">
            Você está a um passo de ver os {BRL(data.parked)}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
            Assim que a conta existir, é só subir sua lista para descobrir quais são os{' '}
            {data.inactive.toLocaleString('pt-BR')} clientes parados.
          </p>
        </div>
      </div>
    </div>
  );
}
