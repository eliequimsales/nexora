import { timingSafeEqual } from "crypto";

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_BUCKETS = 10_000;

/**
 * Rate limit em memória (janela fixa). Suficiente para proteger login/cadastro
 * de força bruta em uma instância única; para múltiplas instâncias, trocar por
 * um contador no Postgres/Redis.
 */
export function rateLimit(key: string, { limit, windowMs }: RateLimitOptions): boolean {
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/** IP do cliente atrás de proxy (Railway/Vercel setam x-forwarded-for). */
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export const TOO_MANY_ATTEMPTS = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";

/** Comparação em tempo constante — evita timing attack em tokens de URL/header. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
