import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { dismissGap } from "@/lib/training";
import { gapActionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Empresa marcou uma dúvida como irrelevante — sai da fila de treinamento. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!gapActionSchema.safeParse(body).success) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  try {
    await dismissGap(companyId, params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    await logError("training-gap-dismiss", error, companyId);
    return NextResponse.json({ error: "Erro ao dispensar a dúvida" }, { status: 500 });
  }
}
