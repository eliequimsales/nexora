import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { sessaoAindaVale } from "@/lib/auth/epoca";

export const SESSION_COOKIE = "rd_session";
const SESSION_DAYS = 7;

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET não configurado");
  return new TextEncoder().encode(secret);
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(companyId: string, epoca: number): Promise<string> {
  return new SignJWT({ ep: epoca })
    .setSubject(companyId)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

/**
 * Verificação criptográfica do token. NÃO confere a época — isso exige o banco
 * e é feito em getSessionCompanyId. Aqui só sai o que o token afirma ser.
 */
export async function lerTokenDeSessao(
  token: string,
): Promise<{ companyId: string; epoca: number | null } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return {
      companyId: payload.sub,
      epoca: typeof payload.ep === "number" ? payload.ep : null,
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(token: string) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/**
 * companyId da sessão atual, ou null.
 *
 * Confere a ÉPOCA contra o banco. O JWT sozinho vale 7 dias e não tem como ser
 * cancelado: sem esta checagem, trocar a senha não expulsava quem já estava
 * dentro — a sessão roubada sobrevivia justamente à ação tomada para matá-la.
 *
 * A consulta a mais é por `id`, indexada, e devolve uma coluna só.
 */
export async function getSessionCompanyId(): Promise<string | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const lido = await lerTokenDeSessao(token);
  if (!lido) return null;

  const conta = await prisma.company.findUnique({
    where: { id: lido.companyId },
    select: { sessaoEpoca: true },
  });
  if (!conta) return null;

  return sessaoAindaVale(lido.epoca, conta.sessaoEpoca) ? lido.companyId : null;
}

/**
 * Derruba TODAS as sessões abertas da conta. Chamada ao trocar a senha e no
 * logout — nos dois casos a pessoa está dizendo "não quero mais quem está
 * dentro", e apagar só o cookie do próprio navegador não faz isso.
 */
export async function revogarSessoes(companyId: string): Promise<number> {
  const atualizado = await prisma.company.update({
    where: { id: companyId },
    data: { sessaoEpoca: { increment: 1 } },
    select: { sessaoEpoca: true },
  });
  return atualizado.sessaoEpoca;
}
