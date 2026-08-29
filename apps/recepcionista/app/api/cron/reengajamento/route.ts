import { NextResponse } from "next/server";
import { logError } from "@/lib/errors";
import { safeEqual } from "@/lib/rate-limit";
import { rodarRegua } from "@/lib/reengajamento/servico";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Régua de reengajamento. Rodar UMA vez por dia.
 *
 * Proteja com o header: x-cron-secret: <CRON_SECRET>
 *
 * Uma vez ao dia é regra, não preferência: o motor garante um e-mail por conta
 * por execução, então rodar de hora em hora furaria o intervalo mínimo e
 * transformaria a régua em spam.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const enviado = request.headers.get("x-cron-secret") ?? "";
  if (!secret || !safeEqual(enviado, secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    return NextResponse.json({ ok: true, ...(await rodarRegua()) });
  } catch (erro) {
    await logError("cron-reengajamento", erro);
    return NextResponse.json({ error: "Falha ao rodar a régua" }, { status: 500 });
  }
}
