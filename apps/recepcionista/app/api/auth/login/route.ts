import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { loginSchema } from "@/lib/validation";
import { clientIp, rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

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

    const company = await prisma.company.findUnique({ where: { email: parsed.data.email } });
    if (!company || !(await verifyPassword(parsed.data.password, company.passwordHash))) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    setSessionCookie(await createSessionToken(company.id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    await logError("auth-login", error);
    return NextResponse.json({ error: "Erro ao entrar" }, { status: 500 });
  }
}
