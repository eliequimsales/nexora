import { NextResponse } from "next/server";
import { z } from "zod";
import { logError } from "@/lib/errors";
import { clientIp, rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { redefinir } from "@/lib/senha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(20).max(200),
  senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres").max(200),
});

export async function POST(request: Request) {
  // Limite apertado: esta rota aceita um token e troca uma senha. É o alvo
  // óbvio de força bruta.
  if (!rateLimit(`redefinir:${clientIp(request)}`, { limit: 10, windowMs: 15 * 60_000 })) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 },
      );
    }

    const r = await redefinir(parsed.data.token, parsed.data.senha);
    if (!r.ok) return NextResponse.json({ error: r.motivo }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (erro) {
    await logError("redefinir-senha", erro);
    return NextResponse.json({ error: "Não consegui redefinir agora" }, { status: 500 });
  }
}
