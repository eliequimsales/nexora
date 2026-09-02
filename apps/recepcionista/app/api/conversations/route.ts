import { NextResponse } from "next/server";
import type { ConversationStatus } from "@nexora/recepcionista-prisma";
import { prisma } from "@/lib/db";
import { getSessionCompanyId } from "@/lib/auth";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["AI", "WAITING_HUMAN", "HUMAN", "FINISHED"] as const;

export async function GET(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("conversas", companyId, LIMITES.leitura)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  const statusParam = new URL(request.url).searchParams.get("status");
  const status = VALID_STATUSES.includes(statusParam as ConversationStatus)
    ? (statusParam as ConversationStatus)
    : undefined;

  const [conversations, counts] = await Promise.all([
    prisma.conversation.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { role: true, content: true } },
      },
    }),
    prisma.conversation.groupBy({
      by: ["status"],
      where: { companyId },
      _count: { _all: true },
    }),
  ]);

  const countByStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      customerName: c.customerName,
      customerPhone: c.customerPhone,
      status: c.status,
      updatedAt: c.updatedAt,
      lastMessage: c.messages[0]
        ? { role: c.messages[0].role, content: c.messages[0].content.slice(0, 120) }
        : null,
    })),
    counts: countByStatus,
  });
}
