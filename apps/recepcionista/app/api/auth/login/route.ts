import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { loginSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { respostaDeLimite, type Politica } from "@/lib/limites";

/** Uma máquina insistindo. */
const IP: Politica = { limit: 10, windowMs: 5 * 60_000 };
/** O ataque distribuído, que o teto por IP não enxerga. */
const CONTA: Politica = { limit: 8, windowMs: 15 * 60_000 };

/**
 * Hash descartável, com o mesmo custo (10) dos hashes reais. Serve só para dar
 * ao bcrypt o mesmo trabalho quando a conta não existe. Não é senha de
 * ninguém e não abre nada: o `!company` abaixo recusa de qualquer forma.
 */
const HASH_FALSO = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

const INVALID_CREDENTIALS = "E-mail ou senha incorretos";

export async function POST(request: Request) {
  try {
    if (!rateLimit(`login:${clientIp(request)}`, IP)) return respostaDeLimite(IP);

    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    // TETO POR CONTA, além do teto por IP.
    //
    // O limite por IP não protege de ataque distribuído: mil máquinas com mil
    // endereços têm mil baldes, e a conta alvo recebe mil tentativas sem
    // estourar nenhum deles. O teto por conta é o único que enxerga o ataque
    // inteiro, porque todas as tentativas apontam para o mesmo e-mail.
    //
    // O custo é real e escolhido: quem souber o e-mail de alguém consegue
    // trancar essa conta por 15 minutos. É incômodo e temporário; a alternativa
    // é deixar a senha ser adivinhada, que é definitivo.
    //
    // Conta inexistente também consome o balde — recusar só quando existe
    // diria, pelo tempo e pelo status, quais e-mails têm conta.
    if (!rateLimit(`login-conta:${parsed.data.email.trim().toLowerCase()}`, CONTA)) {
      return respostaDeLimite(CONTA);
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
