import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCompanyId } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { profileSchema } from "@/lib/validation";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("perfil", companyId, LIMITES.leitura)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  // `profile: true` trazia a linha INTEIRA, incluindo o identificador da
  // instância do WhatsApp, o QR Code em base64 e a última mensagem de erro do
  // gateway. Nada disso é usado por esta tela e nada disso precisa sair do
  // servidor: QR ativo no corpo de uma resposta é sessão de WhatsApp viajando
  // em texto. A lista abaixo é exatamente o que a tela de configurações lê.
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      email: true,
      phone: true,
      plan: true,
      profile: {
        select: {
          description: true,
          address: true,
          productsServices: true,
          pricingInfo: true,
          paymentMethods: true,
          serviceRules: true,
          aiTone: true,
          greetingMessage: true,
          awayMessage: true,
          businessHours: true,
          faqs: true,
          handoffKeywords: true,
          segments: true,
          followUpEnabled: true,
          followUpDelayHours: true,
          followUpMessage: true,
          maxFollowUps: true,
        },
      },
    },
  });
  if (!company) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

  return NextResponse.json(company);
}

export async function PUT(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("perfil", companyId, LIMITES.leitura)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 },
      );
    }

    // A conexão do WhatsApp (instância/status/QR) é gerenciada pelas rotas
    // /api/whatsapp/* — o PUT do perfil nunca toca nesses campos.
    const { name, ...profileData } = parsed.data;

    await prisma.company.update({ where: { id: companyId }, data: { name } });
    // Devolvia a linha atualizada inteira — mesmo problema do GET, e a tela
    // nem lê esse corpo: ela só confere `res.ok`.
    await prisma.companyProfile.update({ where: { companyId }, data: profileData });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await logError("company-profile", error, companyId);
    return NextResponse.json({ error: "Erro ao salvar configurações" }, { status: 500 });
  }
}
