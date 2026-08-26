import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";

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

/** State anti-CSRF: token assinado com validade de 10 minutos. */
export async function createOauthState(): Promise<string> {
  return new SignJWT({ purpose: "google-oauth" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secretKey());
}

export async function verifyOauthState(state: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(state, secretKey());
    return payload.purpose === "google-oauth";
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

  return { email, name: typeof payload.name === "string" ? payload.name : null };
}
