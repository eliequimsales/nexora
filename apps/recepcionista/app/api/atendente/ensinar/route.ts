import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { telaDoAtendente } from "@/lib/atendente/tela";
import { validarOrigemECsrfe } from "@/lib/seguranca/origem";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const erroOrigem = validarOrigemECsrfe(request, { exigirJson: true });
  if (erroOrigem) return erroOrigem;

  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("atendente-ensinar", companyId, LIMITES.escrita)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 300) : "";
  const answer = typeof body?.answer === "string" ? body.answer.trim().slice(0, 1500) : "";
  const gapId = typeof body?.gapId === "string" ? body.gapId : undefined;

  if (!question || !answer) {
    return NextResponse.json({ error: "Escreva a pergunta e a resposta." }, { status: 400 });
  }

  try {
    await prisma.knowledgeItem.create({
      data: {
        companyId,
        question,
        answer,
        source: "TRAINING",
        status: "APPROVED",
        approvedAt: new Date(),
        gapId: gapId ?? null,
      },
    });

    if (gapId) {
      await prisma.knowledgeGap.updateMany({
        where: { id: gapId, companyId },
        data: { status: "ANSWERED" },
      });
    }

    return NextResponse.json({ ok: true, tela: await telaDoAtendente(companyId) });
  } catch (erro) {
    await logError("atendente-ensinar", erro, companyId);
    return NextResponse.json({ error: "Não consegui salvar o ensinamento agora." }, { status: 500 });
  }
}
