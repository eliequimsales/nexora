import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { PLANOS, type PlanoId } from "@/lib/billing/planos";
import {
  validarTokenWebhookAsaas,
  aplicarPasseAsaas,
  aplicarAssinaturaAsaas,
} from "@/lib/billing/asaas";
import {
  reivindicarEventoAsaas,
  marcarProcessadoAsaas,
  marcarFalhaAsaas,
} from "@/lib/billing/asaas-idempotencia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = request.headers.get("asaas-access-token");

  // Autenticação do webhook do Asaas
  if (!validarTokenWebhookAsaas(token)) {
    // Se não estiver configurado o token mas for ambiente de desenvolvimento, avisa
    if (process.env.NODE_ENV !== "production" && !process.env.ASAAS_WEBHOOK_TOKEN) {
      // permite testes locais quando ASAAS_WEBHOOK_TOKEN não estiver no .env
    } else {
      await logError("asaas-webhook-auth", new Error("Token de webhook inválido ou ausente"));
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  const corpo = await request.json().catch(() => null);
  if (!corpo || typeof corpo !== "object" || !corpo.event) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const evento = corpo.event as string;
  const payment = corpo.payment;
  const paymentId = payment?.id;
  const eventId = (corpo.id as string) || (paymentId ? `${paymentId}:${evento}` : null);

  if (!eventId) {
    return NextResponse.json({ error: "ID do evento não identificável" }, { status: 400 });
  }

  // Idempotência atômica com CAS e renovação de lease
  const claim = await reivindicarEventoAsaas(eventId, evento, paymentId);
  if (!claim.ganhou) {
    if (claim.motivo === "ja-processado") {
      return NextResponse.json({ recebido: true, duplicado: true });
    }
    return NextResponse.json({ error: "Evento em processamento" }, { status: 500 });
  }

  let companyId: string | null = null;

  try {
    if (payment) {
      // Extrai companyId e plano do externalReference (formato companyId:plano)
      const extRef = payment.externalReference as string | undefined;
      let planoId: PlanoId = "mensal_cartao";

      if (extRef?.includes(":")) {
        const partes = extRef.split(":");
        companyId = partes[0];
        planoId = (partes[1] as PlanoId) || "mensal_cartao";
      } else if (extRef) {
        companyId = extRef;
      }

      // Se não achou pelo externalReference, busca pelo customer do Asaas
      if (!companyId && payment.customer) {
        const empresa = await prisma.company.findFirst({
          where: { asaasCustomerId: payment.customer },
          select: { id: true },
        });
        companyId = empresa?.id ?? null;
      }

      if (companyId) {
        const cfgPlano = PLANOS[planoId] ?? PLANOS.mensal_cartao;

        if (evento === "PAYMENT_RECEIVED" || evento === "PAYMENT_CONFIRMED") {
          if (cfgPlano.modo === "payment") {
            await aplicarPasseAsaas({
              companyId,
              paymentId: payment.id,
              plano: planoId,
              valorCents: Math.round((payment.value || cfgPlano.valorCents / 100) * 100),
              dias: cfgPlano.dias ?? 30,
            });
          } else {
            await aplicarAssinaturaAsaas({
              companyId,
              subscriptionId: payment.subscription,
              paymentId: payment.id,
              plano: planoId,
            });
          }
        } else if (evento === "PAYMENT_REFUNDED") {
          // Estorno / Arrependimento / Devolução da garantia
          if (cfgPlano.modo === "payment") {
            await prisma.$transaction([
              prisma.passePago.updateMany({
                where: {
                  OR: [
                    { stripeSessionId: `asaas:${payment.id}` },
                    { asaasPaymentId: payment.id },
                  ],
                },
                data: { reembolsadoEm: new Date() },
              }),
              prisma.company.update({
                where: { id: companyId },
                data: { acessoPagoAte: new Date() },
              }),
            ]);
          } else {
            await prisma.company.update({
              where: { id: companyId },
              data: { subscriptionStatus: "canceled" },
            });
          }
        } else if (evento === "PAYMENT_OVERDUE") {
          // Inadimplência / Cartão não autorizado
          await prisma.company.update({
            where: { id: companyId },
            data: {
              subscriptionStatus: "past_due",
              dunningIniciadoEm: new Date(),
            },
          });
        } else if (evento === "PAYMENT_DELETED") {
          // Cancelamento da cobrança
          await prisma.company.update({
            where: { id: companyId },
            data: {
              subscriptionStatus: "canceled",
              canceladoEm: new Date(),
            },
          });
        }
      }
    }

    await marcarProcessadoAsaas(eventId, companyId, claim.tentativa);
    return NextResponse.json({ recebido: true });
  } catch (erro) {
    await marcarFalhaAsaas(eventId, erro, claim.tentativa);
    await logError("asaas-webhook-processamento", erro, companyId ?? undefined);
    return NextResponse.json({ error: "Falha ao processar evento" }, { status: 500 });
  }
}
