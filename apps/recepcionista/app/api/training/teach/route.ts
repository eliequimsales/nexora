import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { teachAnswer } from "@/lib/training";
import { teachSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Empresa respondeu uma dúvida → item fica AGUARDANDO APROVAÇÃO (nunca direto em uso). */
export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = teachSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  try {
    const item = await teachAnswer(companyId, parsed.data);
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    await logError("training-teach", error, companyId);
    return NextResponse.json({ error: "Erro ao registrar o treinamento" }, { status: 500 });
  }
}
