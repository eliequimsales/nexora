import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { getTrainingReport } from "@/lib/training";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Relatório da reunião de Treinamento do Atendente. */
export async function GET() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("treino", companyId, LIMITES.leitura)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    return NextResponse.json(await getTrainingReport(companyId));
  } catch (error) {
    await logError("training-report", error, companyId);
    return NextResponse.json({ error: "Erro ao carregar o treinamento" }, { status: 500 });
  }
}
