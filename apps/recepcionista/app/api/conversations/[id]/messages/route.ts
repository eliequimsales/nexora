import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCompanyId } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { humanMessageSchema } from "@/lib/validation";
import { recordTeamObservation } from "@/lib/training";
import { sendWhatsAppText } from "@/lib/whatsapp/evolution";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = humanMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Mensagem inválida" },
      { status: 400 },
    );
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: params.id, companyId },
    include: { company: { select: { profile: { select: { whatsappInstance: true } } } } },
  });
  if (!conversation) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });

  if (conversation.status !== "HUMAN") {
    return NextResponse.json(
      { error: "Assuma a conversa antes de responder como equipe" },
      { status: 409 },
    );
  }

  const instance = conversation.company.profile?.whatsappInstance;
  if (!instance) {
    return NextResponse.json(
      { error: "Configure a instância do WhatsApp nas Configurações" },
      { status: 400 },
    );
  }

  try {
    await sendWhatsAppText(instance, conversation.customerPhone, parsed.data.content);
  } catch (error) {
    await logError("human-reply", error, companyId);
    return NextResponse.json({ error: "Falha ao enviar pelo WhatsApp" }, { status: 502 });
  }

  const message = await prisma.message.create({
    data: { conversationId: conversation.id, role: "HUMAN", content: parsed.data.content },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  // NALS: a resposta da equipe vira OBSERVAÇÃO (sugestão no treinamento) —
  // nunca conhecimento automático
  const lastCustomerMessage = await prisma.message.findFirst({
    where: { conversationId: conversation.id, role: "CUSTOMER" },
    orderBy: { createdAt: "desc" },
    select: { content: true },
  });
  if (lastCustomerMessage) {
    await recordTeamObservation(companyId, lastCustomerMessage.content, parsed.data.content);
  }

  return NextResponse.json({ ok: true, message });
}
