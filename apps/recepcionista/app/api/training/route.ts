import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { getTrainingReport } from "@/lib/training";

export const dynamic = "force-dynamic";

/** Relatório da reunião de Treinamento do Atendente. */
export async function GET() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    return NextResponse.json(await getTrainingReport(companyId));
  } catch (error) {
    await logError("training-report", error, companyId);
    return NextResponse.json({ error: "Erro ao carregar o treinamento" }, { status: 500 });
  }
}
