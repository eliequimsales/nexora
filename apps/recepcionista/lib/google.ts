import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * OAuth do Google (login/cadastro). Fluxo authorization-code clássico:
 * state assinado (anti-CSRF), troca do code no token endpoint e verificação
 * criptográfica do id_token contra a JWKS pública do Google.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET não configurado");
  return new TextEncoder().encode(secret);
}

export function googleConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;
  if (!clientId || !clientSecret || !appUrl) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / APP_URL não configurados");
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl.replace(/\/+$/, "")}/api/auth/google/callback`,
  };
}

/**
 * State anti-CSRF AMARRADO AO NAVEGADOR.
 *
 * A versão anterior assinava só `{ purpose: "google-oauth" }`. Um JWT assim
 * vale em QUALQUER navegador — deixa de ser token anti-CSRF e vira um carimbo
 * de "veio da Nexora". Com ele dava para fazer login CSRF:
 *
 *   1. O atacante inicia o fluxo no próprio navegador, consente com a conta
 *      Google DELE e intercepta a URL de callback antes de ela ser seguida.
 *      O `code` continua intacto, não foi trocado.
 *   2. Manda o link de callback para a vítima. É navegação GET de topo, então
 *      SameSite=lax não impede.
 *   3. O servidor valida o state (assina, confere), troca o code, recebe o
 *      e-mail do ATACANTE e abre a sessão DELE no navegador da vítima.
 *   4. A vítima, no domínio verdadeiro e com cadeado, importa a base de
 *      clientes dela dentro da conta do atacante.
 *
 * A correção é o par: um valor aleatório vai num cookie httpOnly de vida curta
 * e o HASH dele vai dentro do state. Sem o cookie do mesmo navegador, o state
 * não serve para nada.
 */
export const OAUTH_STATE_COOKIE = "rd_oauth";

export function novoSegredoDeState(): string {
  return randomBytes(32).toString("hex");
}

function digestDoSegredo(segredo: string): string {
  return createHash("sha256").update(segredo).digest("hex");
}

export async function createOauthState(segredo: string): Promise<string> {
  return new SignJWT({ purpose: "google-oauth", bind: digestDoSegredo(segredo) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secretKey());
}

/** Só passa quando o state foi emitido PARA o cookie que este navegador tem. */
export async function verifyOauthState(state: string, segredoDoCookie: string | undefined): Promise<boolean> {
  if (!segredoDoCookie) return false;
  try {
    const { payload } = await jwtVerify(state, secretKey(), { algorithms: ["HS256"] });
    if (payload.purpose !== "google-oauth") return false;
    if (typeof payload.bind !== "string") return false;

    const esperado = Buffer.from(digestDoSegredo(segredoDoCookie));
    const recebido = Buffer.from(payload.bind);
    if (esperado.length !== recebido.length) return false;
    return timingSafeEqual(esperado, recebido);
  } catch {
    return false;
  }
}

/**
 * URL pública do app para redirects. Atrás do proxy do Railway, `request.url`
 * aponta para o host interno (localhost:8080) — nunca usar para redirecionar o
 * navegador. Sempre montar a partir de APP_URL.
 */
export function appRedirect(path: string, fallbackBase?: string): URL {
  const base = process.env.APP_URL?.replace(/\/+$/, "") || fallbackBase || "";
  return new URL(path, base);
}

export function buildAuthUrl(state: string): string {
  const { clientId, redirectUri } = googleConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export interface GoogleUser {
  email: string;
  name: string | null;
  /** Identificador estável da conta Google. É ISTO que é identidade, não o e-mail. */
  sub: string;
}

/** Troca o code por tokens e valida o id_token (assinatura, emissor, audiência). */
export async function exchangeCodeForUser(code: string): Promise<GoogleUser> {
  const { clientId, clientSecret, redirectUri } = googleConfig();

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google token endpoint respondeu ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error("Google não retornou id_token");

  const { payload } = await jwtVerify(data.id_token, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });

  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  if (!email || payload.email_verified !== true) {
    throw new Error("Conta Google sem e-mail verificado");
  }

  // `sub` é o identificador estável da conta Google. Sem ele não há identidade
  // para amarrar, e a conta voltaria a ser encontrada só pelo e-mail.
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  if (!sub) throw new Error("Google não retornou o identificador da conta");

  return { email, sub, name: typeof payload.name === "string" ? payload.name : null };
}
