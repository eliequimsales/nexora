import type Stripe from "stripe";
import { NextResponse } from "next/server";
import {
  convergirAssinatura,
  convergirDoCheckout,
  registrarFalhaPagamento,
} from "@/lib/billing/converger";
import { companyIdDe } from "@/lib/billing/eventos";
import { marcarFalha, marcarProcessado, reivindicar } from "@/lib/billing/idempotencia";
import { stripe } from "@/lib/billing/stripe";
import { logError } from "@/lib/errors";

/**
 * WEBHOOK DA STRIPE.
 *
 * Prisma 5 e a verificação de assinatura não rodam no Edge — daí `nodejs`.
 * Não exportamos `maxDuration`: o deploy é um servidor Node de vida longa no
 * Railway, onde o campo é inerte. O prazo que importa de verdade é outro e não
 * é configurável: o Checkout espera até 10 segundos por esta resposta antes de
 * redirecionar o cliente. Trabalho pesado não entra aqui.
 *
 * O middleware.ts só casa `/painel/:path*`, então esta rota já fica fora da
 * sessão. Se alguém um dia ampliar o matcher para `/api/:path*`, todo webhook
 * passa a receber redirect 307 para /login — e a Stripe trata redirect como
 * FALHA, o que derruba a cobrança inteira sem erro visível.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function assinaturaDaFatura(inv: Stripe.Invoice): string | null {
  const alvo = (inv as unknown as { parent?: { subscription_details?: { subscription?: string | { id: string } } } })
    .parent?.subscription_details?.subscription;
  if (!alvo) return null;
  return typeof alvo === "string" ? alvo : alvo.id;
}

export async function POST(request: Request) {
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  // Falha FECHADA. Sem segredo não há como distinguir a Stripe de qualquer um
  // na internet, e este endpoint concede acesso pago. Aceitar às cegas seria
  // entregar assinatura de graça a quem souber a URL.
  if (!segredo) {
    await logError("stripe-webhook", new Error("STRIPE_WEBHOOK_SECRET ausente"));
    return NextResponse.json({ error: "Webhook não configurado" }, { status: 500 });
  }

  const assinatura = request.headers.get("stripe-signature");
  if (!assinatura) {
    return NextResponse.json({ error: "Sem assinatura" }, { status: 400 });
  }

  // Corpo CRU. `request.json()` reserializa o JSON e invalida a assinatura —
  // 100% dos eventos falhariam, e nenhuma assinatura paga jamais ativaria.
  const corpo = await request.text();

  let evento: Stripe.Event;
  try {
    evento = await stripe().webhooks.constructEventAsync(corpo, assinatura, segredo);
  } catch (erro) {
    await logError("stripe-webhook-assinatura", erro);
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
  }

  const claim = await reivindicar(evento.id, evento.type);
  if (!claim.ganhou) {
    // Já processado: 200, a Stripe para de reenviar.
    if (claim.motivo === "ja-processado") {
      return NextResponse.json({ received: true, duplicado: true });
    }
    // Em voo: 500 de propósito, para a Stripe reentregar depois que a execução
    // atual terminar ou morrer. Responder 200 aqui perderia o evento se a
    // execução em voo falhasse.
    return NextResponse.json({ received: false, emVoo: true }, { status: 500 });
  }

  try {
    const companyId = await processar(evento);

    if (companyId === null) {
      // Evento de outro produto na mesma conta Stripe (o apps/api marca com
      // `orgId`). 200: não é erro nosso, e 500 poria a Stripe em retry de 3
      // dias inundando o ErrorLog.
      await marcarProcessado(evento.id, null);
      return NextResponse.json({ received: true, deOutroProduto: true });
    }

    await marcarProcessado(evento.id, companyId);
    return NextResponse.json({ received: true });
  } catch (erro) {
    // NÃO marca processado: a reentrega da Stripe precisa poder tentar de novo.
    await marcarFalha(evento.id, erro);
    await logError(`stripe-webhook:${evento.type}`, erro);
    return NextResponse.json({ error: "Falha ao processar" }, { status: 500 });
  }
}

async function processar(evento: Stripe.Event): Promise<string | null> {
  switch (evento.type) {
    case "checkout.session.completed": {
      const sessao = evento.data.object as Stripe.Checkout.Session;
      return convergirDoCheckout(sessao.id);
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
    case "customer.subscription.trial_will_end": {
      const sub = evento.data.object as Stripe.Subscription;
      return convergirAssinatura(sub.id);
    }

    case "invoice.paid": {
      const inv = evento.data.object as Stripe.Invoice;
      const subId = assinaturaDaFatura(inv);
      return subId ? convergirAssinatura(subId) : companyIdDe(inv);
    }

    case "invoice.payment_failed": {
      const inv = evento.data.object as Stripe.Invoice;
      const companyId = companyIdDe(inv);
      if (!companyId) {
        // Sem tenant no metadata da fatura, tenta pela assinatura.
        const subId = assinaturaDaFatura(inv);
        if (!subId) return null;
        const doSub = await convergirAssinatura(subId);
        if (doSub) {
          await registrarFalhaPagamento(doSub, "Pagamento não aprovado");
        }
        return doSub;
      }
      await registrarFalhaPagamento(companyId, "Pagamento não aprovado");
      return companyId;
    }

    default:
      return null;
  }
}
