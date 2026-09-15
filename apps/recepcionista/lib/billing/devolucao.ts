import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { enviarEmail } from "@/lib/reengajamento/email";
import { montarConfirmacaoDaGarantia } from "./confirmacao";
import { convergirAssinatura, encerrarAcessoPago } from "./converger";
import { avaliarGarantia } from "./garantia";
import { sinaisDaGarantia } from "./garantia-da-conta";
import { stripe } from "./stripe";

/**
 * A DEVOLUÇÃO DA GARANTIA DINHEIRO RECUPERADO.
 *
 * A ordem não pode mudar:
 *   1. a regra confere, no servidor, com os dados do banco;
 *   2. o pedido é reivindicado — duas abas ou dois cliques viram uma devolução;
 *   3. cada pagamento é estornado com chave de idempotência própria, então tentar
 *      de novo depois de uma falha no meio nunca estorna o mesmo pagamento duas vezes;
 *   4. o que foi devolvido deixa de dar acesso;
 *   5. o comprovante sai, e nunca derruba o que já foi feito.
 *
 * "Tudo o que você pagou" são as faturas pagas da assinatura — no dia 30 a segunda
 * mensalidade já pode ter sido cobrada — e os passes. Só a partir da compra que
 * criou a garantia: pagamento de antes dela não foi feito com essa promessa.
 */

export type ResultadoDaDevolucao =
  | { devolvido: true; valorCents: number }
  | { devolvido: false; http: 409; motivo: string; acao: { texto: string; href: string } };

/** A convergência grava a garantia segundos depois do pagamento, nunca antes dele. */
const FOLGA_MS = 86_400_000;

export async function devolverPelaGarantia(
  companyId: string,
  agora = new Date(),
): Promise<ResultadoDaDevolucao> {
  const decisao = avaliarGarantia(await sinaisDaGarantia(companyId, agora), agora);
  if (!decisao.devolve) {
    return { devolvido: false, http: 409, motivo: decisao.motivo, acao: decisao.acao };
  }

  const vez = await prisma.garantia.updateMany({
    where: { companyId, pedidaEm: null, devolvidaEm: null },
    data: { pedidaEm: agora },
  });
  if (vez.count === 0) {
    return {
      devolvido: false,
      http: 409,
      motivo: "Seu pedido de garantia já está em andamento. Atualize a página em alguns instantes.",
      acao: { texto: "Atualizar minha conta", href: "/painel/assinatura" },
    };
  }

  try {
    const [empresa, registro] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true, email: true, stripeSubscriptionId: true },
      }),
      prisma.garantia.findUnique({ where: { companyId }, select: { criadoEm: true } }),
    ]);
    if (!empresa || !registro) {
      throw new Error(`Garantia pedida sem empresa ou sem registro de garantia: ${companyId}`);
    }

    const desde = new Date(registro.criadoEm.getTime() - FOLGA_MS);
    let devolvidoCents = 0;

    if (empresa.stripeSubscriptionId) {
      devolvidoCents += await devolverAssinatura(companyId, empresa.stripeSubscriptionId, desde);
    }

    const passes = await prisma.passePago.findMany({
      where: { companyId, criadoEm: { gte: desde }, stripePaymentIntentId: { not: null } },
      select: { id: true, stripePaymentIntentId: true },
    });
    for (const passe of passes) {
      devolvidoCents += await estornar(companyId, passe.stripePaymentIntentId as string);
      await prisma.passePago.updateMany({
        where: { id: passe.id, reembolsadoEm: null },
        data: { reembolsadoEm: new Date() },
      });
    }

    await encerrarAcessoPago(companyId, agora);

    await prisma.garantia.update({
      where: { companyId },
      data: { devolvidaEm: new Date(), valorDevolvidoCents: devolvidoCents },
    });

    try {
      await enviarEmail(
        empresa.email,
        montarConfirmacaoDaGarantia({ nome: empresa.name, valorCents: devolvidoCents }),
      );
    } catch (erro) {
      await logError("garantia-comprovante", erro, companyId);
    }

    return { devolvido: true, valorCents: devolvidoCents };
  } catch (erro) {
    // Devolve a vez para o dono poder tentar de novo. O que já foi estornado tem
    // chave de idempotência e não se repete.
    await prisma.garantia
      .updateMany({ where: { companyId, devolvidaEm: null }, data: { pedidaEm: null } })
      .catch((falha) => logError("garantia-devolver-vez", falha, companyId));
    throw erro;
  }
}

/**
 * Estorna cada fatura paga da assinatura desde a compra e encerra a assinatura na
 * hora: o dinheiro do período voltou, então o período também acaba.
 */
async function devolverAssinatura(
  companyId: string,
  subscriptionId: string,
  desde: Date,
): Promise<number> {
  let devolvido = 0;

  const faturas = await stripe().invoices.list({
    subscription: subscriptionId,
    status: "paid",
    created: { gte: Math.floor(desde.getTime() / 1000) },
    limit: 100,
  });

  for (const fatura of faturas.data) {
    // A fatura de R$ 0 do período de teste não tem dinheiro a devolver.
    if (!fatura.id || fatura.amount_paid <= 0) continue;

    // Na API 2026-08-26.dahlia o pagamento da fatura mora em InvoicePayments.
    const pagamentos = await stripe().invoicePayments.list({
      invoice: fatura.id,
      status: "paid",
      limit: 100,
    });
    for (const pagamento of pagamentos.data) {
      const pi = pagamento.payment.payment_intent;
      const id = typeof pi === "string" ? pi : pi?.id;
      if (id) devolvido += await estornar(companyId, id);
    }
  }

  const assinatura = await stripe().subscriptions.retrieve(subscriptionId);
  if (assinatura.status !== "canceled" && assinatura.status !== "incomplete_expired") {
    await stripe().subscriptions.cancel(subscriptionId);
  }

  // Converge já, sem esperar o webhook: a tela da volta precisa mostrar o plano encerrado.
  await convergirAssinatura(subscriptionId);

  return devolvido;
}

async function estornar(companyId: string, paymentIntentId: string): Promise<number> {
  try {
    const estorno = await stripe().refunds.create(
      {
        payment_intent: paymentIntentId,
        reason: "requested_by_customer",
        metadata: { companyId, motivo: "garantia" },
      },
      { idempotencyKey: `garantia:${companyId}:${paymentIntentId}` },
    );
    return estorno.amount;
  } catch (erro) {
    // Já estornado antes — pelo arrependimento de 7 dias, por exemplo: desse
    // pagamento não há mais nada a devolver, e o pedido segue com os outros.
    if ((erro as { code?: string })?.code === "charge_already_refunded") return 0;
    throw erro;
  }
}
