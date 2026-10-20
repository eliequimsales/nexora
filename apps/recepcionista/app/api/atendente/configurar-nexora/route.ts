import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** O antigo atalho publicava exemplos como fatos, ativava o atendimento e alterava
 * assinatura/número sem comprovação. Use agora as telas normais com dados do dono. */
export async function POST() {
  const companyId = await getSessionCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!limitar("configurar-nexora", companyId, LIMITES.escrita)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }
  return NextResponse.json({
    error: "Revise e salve as informações reais do seu negócio antes de ligar o atendimento.",
    proximoPasso: "/painel/atendente",
  }, { status: 410 });
}

export function GET() {
  return NextResponse.json({ error: "Esta ação não está disponível por este endereço." },
    { status: 405, headers: { Allow: "POST" } });
}
