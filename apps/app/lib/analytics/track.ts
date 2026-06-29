/**
 * Tracking de funil — analytics próprio (sem ferramenta externa, dado no Postgres).
 * Mede onde a clínica trava: landing → cta → signup → analyze → result → feedback.
 * Sem PII: só um id anônimo do navegador.
 */

export type FunnelEventName =
  | 'landing_view'
  | 'cta_pilot'
  | 'signup'
  | 'analyze'
  | 'result'
  | 'feedback';

function anonId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem('nx_anon');
    if (!id) {
      id = (crypto.randomUUID?.() ?? String(Date.now() + Math.random())).slice(0, 64);
      localStorage.setItem('nx_anon', id);
    }
    return id;
  } catch {
    return '';
  }
}

export function track(name: FunnelEventName, orgSlug?: string): void {
  if (typeof window === 'undefined') return;
  try {
    fetch('/api/v1/customer-recovery/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, anonId: anonId(), orgSlug }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // analytics nunca quebra a experiência
  }
}
