import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { suggestSegments } from "@/lib/segments";

export const dynamic = "force-dynamic";

/**
 * Descoberta Assistida: gera HIPÓTESES ranqueadas de área de atuação a partir
 * do nome + descrição. Nunca decide nem salva nada — quem escolhe é a empresa.
 */
export async function POST() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!rateLimit(`segment-detect:${companyId}`, { limit: 10, windowMs: 5 * 60_000 })) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { name: true, profile: { select: { description: true } } },
    });
    const hypotheses = await suggestSegments(company.name, company.profile?.description ?? "");
    return NextResponse.json({ hypotheses });
  } catch (error) {
    await logError("segment-detect-route", error, companyId);
    return NextResponse.json({ error: "Não consegui sugerir áreas agora" }, { status: 500 });
  }
}
