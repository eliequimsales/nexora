import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { loginSchema } from "@/lib/validation";
import { clientIp, rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

/**
 * Hash descartável, com o mesmo custo (10) dos hashes reais. Serve só para dar
 * ao bcrypt o mesmo trabalho quando a conta não existe. Não é senha de
 * ninguém e não abre nada: o `!company` abaixo recusa de qualquer forma.
 */
const HASH_FALSO = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

const INVALID_CREDENTIALS = "E-mail ou senha incorretos";

export async function POST(request: Request) {
  try {
    if (!rateLimit(`login:${clientIp(request)}`, { limit: 10, windowMs: 5 * 60_000 })) {
      return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    // select explícito: sem ele o Prisma traz passwordHash, stripeCustomerId,
    // taxId e o resto da Company para uma rota que precisa de três campos.
    const company = await prisma.company.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, passwordHash: true, sessaoEpoca: true },
    });

    // O bcrypt roda SEMPRE, inclusive quando a conta não existe.
    //
    // Antes, e-mail inexistente respondia na hora e e-mail real demorava os
    // ~100ms do bcrypt: a diferença é medível pela rede e dizia quais e-mails
    // têm conta. Isso anulava o cuidado anti-enumeração de /api/auth/recuperar,
    // que responde igual para todo mundo justamente para não entregar isso.
    const hash = company?.passwordHash ?? HASH_FALSO;
    const senhaConfere = await verifyPassword(parsed.data.password, hash);

    if (!company || !senhaConfere) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    setSessionCookie(await createSessionToken(company.id, company.sessaoEpoca));
    return NextResponse.json({ ok: true });
  } catch (error) {
    await logError("auth-login", error);
    return NextResponse.json({ error: "Erro ao entrar" }, { status: 500 });
  }
}
