import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { reviewKnowledgeItem } from "@/lib/training";
import { reviewItemSchema } from "@/lib/validation";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Aprovar (com edição opcional) ou rejeitar um conhecimento sugerido. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("treino-item", companyId, LIMITES.escrita)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = reviewItemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Ação inválida" }, { status: 400 });

  try {
    await reviewKnowledgeItem(companyId, params.id, parsed.data.action, {
      question: parsed.data.question,
      answer: parsed.data.answer,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await logError("training-review", error, companyId);
    return NextResponse.json({ error: "Erro ao salvar a decisão" }, { status: 500 });
  }
}
