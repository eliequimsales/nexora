'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  allTimeTotals,
  readStore,
  todayTotals,
  writeStore,
  type RecoveryStatus,
  type RecoveryStore,
} from '@/lib/recovery/tracking';
import { confirmRecoveryOnServer } from '@/lib/recovery/sync';

/**
 * Estado local de recuperação, persistido em localStorage.
 *
 * A leitura acontece depois da montagem (não no primeiro render) porque o
 * componente é renderizado no servidor primeiro — ler storage direto causaria
 * divergência de hidratação.
 *
 * Modelo local-first: a UI muda na hora e o servidor é avisado depois, sem
 * bloquear nem reverter nada em caso de falha.
 *
 * TODO: futuramente reconciliar com backend ao carregar
 */
export function useRecoveryTracking() {
  const [store, setStore] = useState<RecoveryStore>({});
  const [hydrated, setHydrated] = useState(false);

  // Espelho do estado atual. Permite decidir sobre o efeito de rede sem
  // depender do updater do React (que pode reexecutar em StrictMode) nem
  // capturar `store` desatualizado no useCallback.
  const storeRef = useRef<RecoveryStore>({});

  useEffect(() => {
    const initial = readStore();
    storeRef.current = initial;
    setStore(initial);
    setHydrated(true);
  }, []);

  const apply = useCallback((next: RecoveryStore) => {
    storeRef.current = next;
    setStore(next);
    writeStore(next);
  }, []);

  const setStatus = useCallback(
    (id: string, status: RecoveryStatus, recoveredValue?: number) => {
      const prev = storeRef.current;
      const alreadyConverted = prev[id]?.status === 'converted';
      const now = new Date().toISOString();

      const value = status === 'converted' ? (recoveredValue ?? prev[id]?.recoveredValue) : undefined;

      apply({
        ...prev,
        [id]: {
          ...prev[id],
          id,
          status,
          updatedAt: now,
          recoveredValue: value,
          convertedAt: status === 'converted' ? now : undefined,
        },
      });

      // Sync oportunista: fora do updater (evita disparo duplicado) e só na
      // transição para "converted" (reconfirmar dobraria a receita no servidor).
      if (status === 'converted' && !alreadyConverted && typeof value === 'number') {
        confirmRecoveryOnServer(id, value).catch((err) => {
          // Silencioso de propósito: o registro local vale, o usuário não vê erro.
          console.error('[nexora] sync de recuperação falhou', err);
        });
      }
    },
    [apply],
  );

  const reset = useCallback(
    (id: string) => {
      const next = { ...storeRef.current };
      delete next[id];
      apply(next);
    },
    [apply],
  );

  const today = useMemo(() => todayTotals(store), [store]);
  const allTime = useMemo(() => allTimeTotals(store), [store]);

  return { store, hydrated, setStatus, reset, today, allTime };
}
