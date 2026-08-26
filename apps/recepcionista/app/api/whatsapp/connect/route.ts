import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { connectWhatsApp } from "@/lib/whatsapp/instance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Cria a instância da empresa na Evolution, configura o webhook e gera o QR. */
export async function POST() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!rateLimit(`wa-connect:${companyId}`, { limit: 10, windowMs: 5 * 60_000 })) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  const state = await connectWhatsApp(companyId);
  if (state.status === "ERROR") {
    return NextResponse.json(
      { error: state.error ?? "Falha ao conectar com o servidor de WhatsApp", state },
      { status: 502 },
    );
  }
  return NextResponse.json({ state });
}
