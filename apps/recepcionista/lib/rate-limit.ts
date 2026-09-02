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

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-f:]{2,45}$/i;

/**
 * IP do cliente atrás do proxy.
 *
 * A versão anterior pegava `.split(",")[0]` — o PRIMEIRO elemento do
 * X-Forwarded-For. Nenhum proxy reescreve esse header: ele APENDA o IP real ao
 * fim da cadeia. O primeiro elemento é, portanto, o que o cliente mandou, e o
 * atacante trocava de identidade a cada requisição — anulando o rate limit do
 * login, do cadastro e da recuperação de senha, e enchendo o mapa de baldes
 * com chaves inventadas.
 *
 * O elemento confiável é o ÚLTIMO: foi escrito pelo proxy mais próximo.
 *
 * O formato é validado antes de virar chave. Sem isso o atacante escolhe a
 * chave do balde e transforma o rate limit num vetor de consumo de memória.
 */
export function clientIp(request: Request): string {
  const cadeia = request.headers.get("x-forwarded-for");
  if (!cadeia) return DESCONHECIDO;

  const partes = cadeia.split(",").map((p) => p.trim()).filter(Boolean);
  const ultimo = partes[partes.length - 1];
  if (!ultimo) return DESCONHECIDO;

  return IPV4.test(ultimo) || IPV6.test(ultimo) ? ultimo : DESCONHECIDO;
}

/**
 * Todos os clientes sem IP legível caem no MESMO balde, de propósito. Isso
 * aperta o limite para eles em conjunto — que é o comportamento seguro quando
 * não dá para distinguir quem é quem.
 */
const DESCONHECIDO = "desconhecido";

export const TOO_MANY_ATTEMPTS = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";

/** Comparação em tempo constante — evita timing attack em tokens de URL/header. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
