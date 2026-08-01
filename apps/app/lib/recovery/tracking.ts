/**
 * Tracking de recuperação — 100% local (localStorage), sem backend.
 *
 * Registra o que o usuário marcou à mão: quem foi contatado, quem respondeu e
 * quem voltou a comprar. O valor recuperado vem do `estimatedValue` que a API
 * já devolve — nada é inventado aqui.
 *
 * Limite consciente: por ser local, o registro vale para este navegador.
 */

export type RecoveryStatus = 'idle' | 'contacted' | 'responded' | 'converted';

export interface TrackedClient {
  id: string;
  status: RecoveryStatus;
  recoveredValue?: number;
  /** ISO — última mudança de status. */
  updatedAt: string;
  /** ISO — quando virou cliente. Permite dizer "hoje" sem mentir. */
  convertedAt?: string;
}

export type RecoveryStore = Record<string, TrackedClient>;

export const STORAGE_KEY = 'nexora.recovery';

const VALID: RecoveryStatus[] = ['idle', 'contacted', 'responded', 'converted'];

/** Lê o registro local. Nunca lança — storage pode estar bloqueado ou corrompido. */
export function readStore(): RecoveryStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    // Sanitiza: descarta qualquer entrada malformada em vez de confiar no disco.
    const clean: RecoveryStore = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      const v = value as Partial<TrackedClient>;
      if (!v || typeof v !== 'object') continue;
      if (typeof v.status !== 'string' || !VALID.includes(v.status as RecoveryStatus)) continue;
      clean[id] = {
        id,
        status: v.status as RecoveryStatus,
        recoveredValue:
          typeof v.recoveredValue === 'number' && Number.isFinite(v.recoveredValue)
            ? v.recoveredValue
            : undefined,
        updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : new Date().toISOString(),
        convertedAt: typeof v.convertedAt === 'string' ? v.convertedAt : undefined,
      };
    }
    return clean;
  } catch {
    return {};
  }
}

/** Persiste o registro. Silencioso em falha (quota/modo privado). */
export function writeStore(store: RecoveryStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Sem storage o app segue funcionando — só não lembra entre recargas.
  }
}

export function statusOf(store: RecoveryStore, id: string): RecoveryStatus {
  return store[id]?.status ?? 'idle';
}

function isSameLocalDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export interface RecoveryTotals {
  count: number;
  value: number;
}

/** Só o que foi convertido hoje — o header diz "hoje", então precisa ser hoje. */
export function todayTotals(store: RecoveryStore, now: Date = new Date()): RecoveryTotals {
  return Object.values(store).reduce<RecoveryTotals>(
    (acc, entry) => {
      if (entry.status !== 'converted' || !entry.convertedAt) return acc;
      if (!isSameLocalDay(entry.convertedAt, now)) return acc;
      return { count: acc.count + 1, value: acc.value + (entry.recoveredValue ?? 0) };
    },
    { count: 0, value: 0 },
  );
}

/** Acumulado — usado como contexto secundário no header. */
export function allTimeTotals(store: RecoveryStore): RecoveryTotals {
  return Object.values(store).reduce<RecoveryTotals>(
    (acc, entry) =>
      entry.status === 'converted'
        ? { count: acc.count + 1, value: acc.value + (entry.recoveredValue ?? 0) }
        : acc,
    { count: 0, value: 0 },
  );
}

export const STATUS_BADGE: Record<
  RecoveryStatus,
  { label: string; variant: 'default' | 'info' | 'success' } | null
> = {
  idle: null,
  contacted: { label: 'Contato iniciado', variant: 'default' },
  responded: { label: 'Respondeu', variant: 'info' },
  converted: { label: 'Recuperado 💰', variant: 'success' },
};
