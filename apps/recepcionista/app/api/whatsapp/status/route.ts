import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { refreshWhatsAppStatus } from "@/lib/whatsapp/instance";

export const dynamic = "force-dynamic";

/**
 * Estado atual da conexão WhatsApp da empresa.
 * ?sync=1 consulta a Evolution e sincroniza; sem o parâmetro, lê só o banco
 * (que é atualizado em tempo real pelos webhooks CONNECTION_UPDATE/QRCODE_UPDATED).
 */
export async function GET(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const sync = new URL(request.url).searchParams.get("sync") === "1";

  if (sync) {
    return NextResponse.json({ state: await refreshWhatsAppStatus(companyId) });
  }

  const profile = await prisma.companyProfile.findUnique({
    where: { companyId },
    select: {
      whatsappStatus: true,
      whatsappQrCode: true,
      whatsappConnectedAt: true,
      whatsappError: true,
    },
  });
  if (!profile) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

  return NextResponse.json({
    state: {
      status: profile.whatsappStatus,
      qrCode: profile.whatsappQrCode,
      connectedAt: profile.whatsappConnectedAt?.toISOString() ?? null,
      error: profile.whatsappError,
    },
  });
}
