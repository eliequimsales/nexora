import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Retorna a quantidade de dúvidas pendentes no treinamento para exibição de badge de notificação. */
export async function GET() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ count: 0 });

  try {
    const count = await prisma.knowledgeGap.count({
      where: { companyId, status: "OPEN" },
    });
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
