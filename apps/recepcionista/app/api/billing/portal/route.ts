import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { stripe, stripeConfigurado } from "@/lib/billing/stripe";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Portal do cliente da Stripe.
 *
 * É aqui que o dono troca o cartão, baixa a nota da Stripe e CANCELA sozinho.
 * Deixar o cancelamento a um clique é decisão de produto, não descuido: quem
 * vende "risco zero" e esconde o botão de sair está contando com a fricção
 * para reter — exatamente o oposto da oferta.
 *
 * O cancelamento feito por aqui é `cancel_at_period_end`, o padrão do Portal:
 * o dono fica com o período que já pagou. Cancelar na hora sem devolver o mês
 * gera contestação, e cada contestação custa R$ 55,00 — quase 70% de uma
 * mensalidade.
 */
export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("portal", companyId, LIMITES.terceiro)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  if (!stripeConfigurado()) {
    return NextResponse.json(
      { error: "A cobrança ainda não está configurada." },
      { status: 503 },
    );
  }

  try {
    const empresa = await prisma.company.findUnique({
      where: { id: companyId },
      select: { stripeCustomerId: true },
    });

    if (!empresa?.stripeCustomerId) {
      return NextResponse.json(
        { error: "Você ainda não tem uma assinatura para gerenciar." },
        { status: 404 },
      );
    }

    const appUrl = process.env.APP_URL ?? new URL(request.url).origin;

    const sessao = await stripe().billingPortal.sessions.create({
      customer: empresa.stripeCustomerId,
      return_url: `${appUrl}/painel/assinatura`,
    });

    return NextResponse.json({ url: sessao.url });
  } catch (erro) {
    await logError("billing-portal", erro, companyId);
    return NextResponse.json({ error: "Não consegui abrir o portal agora" }, { status: 500 });
  }
}
