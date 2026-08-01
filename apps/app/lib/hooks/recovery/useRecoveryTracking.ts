'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  allTimeTotals,
  readStore,
  todayTotals,
  writeStore,
  type RecoveryStatus,
  type RecoveryStore,
} from '@/lib/recovery/tracking';

/**
 * Estado local de recuperação, persistido em localStorage.
 *
 * A leitura acontece depois da montagem (não no primeiro render) porque o
 * componente é renderizado no servidor primeiro — ler storage direto causaria
 * divergência de hidratação.
 */
export function useRecoveryTracking() {
  const [store, setStore] = useState<RecoveryStore>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setStore(readStore());
    setHydrated(true);
  }, []);

  /** Aplica a mudança no estado e no disco na mesma transição. */
  const commit = useCallback((next: RecoveryStore) => {
    setStore(next);
    writeStore(next);
  }, []);

  const setStatus = useCallback(
    (id: string, status: RecoveryStatus, recoveredValue?: number) => {
      setStore((prev) => {
        const now = new Date().toISOString();
        const entry = {
          ...prev[id],
          id,
          status,
          updatedAt: now,
          recoveredValue:
            status === 'converted' ? (recoveredValue ?? prev[id]?.recoveredValue) : undefined,
          convertedAt: status === 'converted' ? now : undefined,
        };
        const next = { ...prev, [id]: entry };
        writeStore(next);
        return next;
      });
    },
    [],
  );

  const reset = useCallback(
    (id: string) => {
      setStore((prev) => {
        const next = { ...prev };
        delete next[id];
        writeStore(next);
        return next;
      });
    },
    [],
  );

  const today = useMemo(() => todayTotals(store), [store]);
  const allTime = useMemo(() => allTimeTotals(store), [store]);

  return { store, hydrated, setStatus, reset, commit, today, allTime };
}
