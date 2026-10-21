import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { validarOrigemECsrfe } from "@/lib/seguranca/origem";

export const dynamic = "force-dynamic";

/** Compatibilidade de leitura. A entrevista antiga não aprova mais dados automaticamente. */

export async function GET() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("atendente", companyId, LIMITES.leitura)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  return NextResponse.json({
    mensagem: "A configuração agora tem uma área própria. Você pode descrever seu negócio no preenchimento assistido e revisar cada informação antes de aplicar.",
    sugestoes: [],
    proximoPasso: "/painel/atendente",
  });
}

export async function POST(request: Request) {
  const erroOrigem = validarOrigemECsrfe(request, { exigirJson: true });
  if (erroOrigem) return erroOrigem;
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("atendente-ajuste", companyId, LIMITES.escrita)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  return NextResponse.json({
    error: "Use a configuração guiada para revisar as informações antes de aplicá-las.",
    resposta: "Abra a configuração do atendente e use o preenchimento assistido. Vou preparar uma proposta para sua revisão.",
    proximoPasso: "/painel/atendente",
  }, { status: 410 });
}
