import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, hashPassword, setSessionCookie } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { signupSchema } from "@/lib/validation";
import { VERSAO_DOCUMENTOS } from "@/lib/legal/identidade";
import { clientIp, rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    if (!rateLimit(`signup:${clientIp(request)}`, { limit: 5, windowMs: 15 * 60_000 })) {
      return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 },
      );
    }

    const { name, email, password, phone } = parsed.data;

    const existing = await prisma.company.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: "Já existe uma conta com este e-mail" }, { status: 409 });
    }

    const company = await prisma.company.create({
      data: {
        name,
        email,
        phone,
        passwordHash: await hashPassword(password),
        // Grava DATA e VERSAO do que foi aceito. Sem a versao o registro e
        // inutil: o texto muda e ninguem sabe mais o que a pessoa leu.
        termosAceitosEm: new Date(),
        termosVersao: VERSAO_DOCUMENTOS,
        profile: { create: {} },
      },
    });

    setSessionCookie(await createSessionToken(company.id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    await logError("auth-signup", error);
    return NextResponse.json({ error: "Erro ao criar conta" }, { status: 500 });
  }
}
