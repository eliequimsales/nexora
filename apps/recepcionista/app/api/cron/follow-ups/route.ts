import { NextResponse } from "next/server";
import { runFollowUps } from "@/lib/followup";
import { logError } from "@/lib/errors";
import { safeEqual } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Disparo manual/externo de follow-ups (o worker interno já roda sozinho).
 * Proteja com o header: x-cron-secret: <CRON_SECRET>
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret") ?? "";
  if (!secret || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const sent = await runFollowUps();
    return NextResponse.json({ ok: true, sent });
  } catch (error) {
    await logError("cron-follow-ups", error);
    return NextResponse.json({ error: "Falha ao executar follow-ups" }, { status: 500 });
  }
}
