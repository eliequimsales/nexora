import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { getReports } from "@/lib/reports";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("reports", companyId, LIMITES.pesado)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  const daysParam = parseInt(new URL(request.url).searchParams.get("days") ?? "30", 10);
  const days = Math.min(90, Math.max(1, Number.isNaN(daysParam) ? 30 : daysParam));

  const reports = await getReports(companyId, days);
  return NextResponse.json(reports);
}
