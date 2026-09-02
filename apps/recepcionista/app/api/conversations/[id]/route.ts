import { NextResponse } from "next/server";
import type { ConversationStatus } from "@nexora/recepcionista-prisma";
import { prisma } from "@/lib/db";
import { getSessionCompanyId } from "@/lib/auth";
import { conversationActionSchema } from "@/lib/validation";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("conversa", companyId, LIMITES.leitura)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: params.id, companyId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 500 },
      lead: true,
    },
  });
  if (!conversation) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });

  return NextResponse.json({ conversation });
}

const ACTION_MAP: Record<string, { status: ConversationStatus; note: string }> = {
  assumir: { status: "HUMAN", note: "Sua equipe assumiu a conversa — Atendente pausado" },
  reativar_ia: { status: "AI", note: "Atendente reativado — voltou a responder esta conversa" },
  finalizar: { status: "FINISHED", note: "Conversa finalizada" },
};

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("conversa", companyId, LIMITES.leitura)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = conversationActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const existing = await prisma.conversation.findFirst({
    where: { id: params.id, companyId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });

  const { status, note } = ACTION_MAP[parsed.data.action];
  const conversation = await prisma.conversation.update({
    where: { id: existing.id },
    data: { status },
  });
  await prisma.message.create({
    data: { conversationId: existing.id, role: "SYSTEM", content: note },
  });

  return NextResponse.json({ ok: true, status: conversation.status });
}
