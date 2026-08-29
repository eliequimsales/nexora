import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { TRIAL_DIAS } from "@/lib/billing/acesso";
import { stripe, stripeConfigurado } from "@/lib/billing/stripe";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Abre o Checkout hospedado da Stripe.
 *
 * Hospedado, e não Payment Element, porque o Checkout já entrega em pt-BR:
 * cartão com 3DS, boleto com a página do voucher, atualização de cartão quando
 * a renovação falha, e mantém a operação em PCI SAQ-A. Cada uma dessas telas
 * feita à mão é uma semana que não vira Receita Recuperada.
 *
 * Pix NÃO entra: a Stripe no Brasil não faz Pix recorrente (o Pix Automático
 * não está disponível para contas BR). Anunciar Pix e não ter o botão no
 * checkout queimaria o lead exatamente na hora de pagar.
 */
export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!stripeConfigurado()) {
    return NextResponse.json(
      { error: "A cobrança ainda não está configurada. Fale com a gente." },
      { status: 503 },
    );
  }

  if (!rateLimit(`checkout:${companyId}`, { limit: 10, windowMs: 10 * 60_000 })) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const empresa = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, email: true, stripeCustomerId: true },
    });
    if (!empresa) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

    const appUrl = process.env.APP_URL ?? new URL(request.url).origin;

    let customerId = empresa.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe().customers.create({
        email: empresa.email,
        name: empresa.name,
        metadata: { companyId },
      });
      customerId = customer.id;
      await prisma.company.update({
        where: { id: companyId },
        data: { stripeCustomerId: customerId },
      });
    }

    const sessao = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_PRO!, quantity: 1 }],

      // Trial sem cartão: no ICP brasileiro pequeno, exigir cartão para testar
      // derruba o topo do funil a ponto de não haver o que medir.
      payment_method_collection: "if_required",
      subscription_data: {
        trial_period_days: TRIAL_DIAS,
        trial_settings: {
          end_behavior: {
            // `pause`, nunca `cancel`. Pausada, a assinatura SOBREVIVE: quando
            // o dono põe o cartão depois, retomamos a MESMA assinatura com o
            // histórico dele. Com `cancel`, quem voltasse três dias depois
            // recomeçaria do zero.
            missing_payment_method: "pause",
          },
        },
        // O tenant precisa viajar no objeto que os webhooks entregam.
        metadata: { companyId },
      },
      metadata: { companyId },

      // O Brasil não é suportado pelo Stripe Tax. O preço é imposto-incluso e
      // a NFS-e sai fora da Stripe, no CNPJ do titular.
      automatic_tax: { enabled: false },

      // `{CHECKOUT_SESSION_ID}` é obrigatório: é ele que deixa a página de
      // retorno convergir sozinha se o webhook ainda não chegou. Sem isso o
      // dono paga, volta ao painel e lê "período de teste".
      success_url: `${appUrl}/painel/assinatura?ok=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/painel/assinatura?cancelado=1`,
    });

    // Carrinho abandonado: marca a intenção AGORA. Quem chegou até aqui e não
    // voltou é a lista mais quente que existe, e sem esta marca não há como
    // saber quem foi. É apagada quando a assinatura nasce.
    await prisma.company.update({
      where: { id: companyId },
      data: { checkoutAbertoEm: new Date() },
    });

    return NextResponse.json({ url: sessao.url });
  } catch (erro) {
    await logError("billing-checkout", erro, companyId);
    return NextResponse.json(
      { error: "Não consegui abrir o pagamento agora" },
      { status: 500 },
    );
  }
}
