/**
 * CONVERGÊNCIA DO ESTADO DA ASSINATURA.
 *
 * Nenhum handler escreve a partir do payload do evento. Todos re-buscam o
 * objeto vivo na Stripe e gravam o que ela responde AGORA.
 *
 * Isso resolve a entrega fora de ordem sem nenhuma cerca de timestamp: se um
 * evento de três dias atrás chega hoje, o re-fetch devolve o estado atual e o
 * banco converge para a verdade — enquanto uma cerca "ignore o que é mais
 * velho" jogaria fora justamente a escrita mais fresca que temos em mãos.
 *
 * Consequência boa: todo handler vira idempotente por construção. Rodar duas
 * vezes grava o mesmo estado.
 *
 * ESCRITOR ÚNICO: só `aplicarAssinatura` toca em subscriptionStatus, plan,
 * currentPeriodEnd e trialEndsAt. Falha de pagamento NÃO escreve status — dois
 * escritores no mesmo campo é como o estado da conta começa a mentir.
 */

import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { companyIdDe, deveProvisionar, periodoFimDe } from "./eventos";
import { stripe } from "./stripe";
import { deveConfirmar, montarConfirmacao } from "./confirmacao";
import { enviarEmail } from "@/lib/reengajamento/email";
import { logError } from "@/lib/errors";

function paraData(seg: number | null | undefined): Date | null {
  return typeof seg === "number" && Number.isFinite(seg) ? new Date(seg * 1000) : null;
}

/** Rótulo grosso para exibição. O acesso real é decidido por subscriptionStatus. */
function planoDoStatus(status: string): string {
  if (status === "trialing") return "trial";
  if (status === "active" || status === "past_due" || status === "unpaid") return "pro";
  return "canceled";
}

/**
 * Grava o estado da assinatura no Company. Devolve o companyId, ou null quando
 * a assinatura pertence a outro produto da mesma conta Stripe.
 */
export async function aplicarAssinatura(sub: Stripe.Subscription): Promise<string | null> {
  const companyId = companyIdDe(sub);
  if (!companyId) return null;

  // Precisamos do valor atual porque `canceladoEm` é a data do PRIMEIRO
  // cancelamento, não da última vez que um evento passou por aqui.
  const atual = await prisma.company.findUnique({
    where: { id: companyId },
    select: { canceladoEm: true, confirmacaoEnviadaEm: true, name: true, email: true },
  });

  await prisma.company.update({
    where: { id: companyId },
    data: {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      subscriptionStatus: sub.status,
      plan: planoDoStatus(sub.status),
      currentPeriodEnd: periodoFimDe(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEndsAt: paraData(sub.trial_end),

      // A assinatura nasceu: ele não abandonou o carrinho. Sem limpar, a régua
      // mandaria "faltou pouco para terminar" para quem já é cliente pagante.
      checkoutAbertoEm: null,

      // Marca o cancelamento UMA vez, na primeira vez que o status vira
      // canceled. Este handler roda a cada evento; regravar a data reiniciaria
      // o relógio do e-mail de 14 dias a cada reentrega, para sempre.
      ...(sub.status === "canceled" && !atual?.canceladoEm
        ? { canceladoEm: new Date() }
        : {}),
      // Voltou a ser cliente: o relógio some, senão ele receberia "sua base
      // ainda está aqui" duas semanas depois de já ter reativado.
      ...(sub.status === "active" || sub.status === "trialing"
        ? { canceladoEm: null }
        : {}),
      // Pagou: zera o dunning. Sem isto, uma conta que se regularizou
      // continuaria carregando o relógio de tolerância da falha anterior.
      ...(sub.status === "active" || sub.status === "trialing"
        ? { falhasSeguidas: 0, dunningIniciadoEm: null, ultimoErroPagamento: null }
        : {}),
    },
  });

  await confirmarContratacao(companyId, sub, atual);

  return companyId;
}

/**
 * CONFIRMAÇÃO DA CONTRATAÇÃO — Decreto 7.962/2013, art. 4º, V.
 *
 * Fica aqui, e não no motor de reengajamento, porque é e-mail transacional: não
 * respeita o intervalo mínimo entre envios, não entra na fila de "um e-mail por
 * dia" e não é bloqueado por `semEmail`. Recusar marketing não é recusar o
 * comprovante daquilo que se contratou.
 *
 * Nunca derruba a convergência. Se o Resend estiver fora do ar, o estado da
 * assinatura já foi gravado e é isso que decide o acesso do dono — deixar o
 * e-mail quebrar a gravação trocaria um problema legal por um cliente pagante
 * sem acesso ao que pagou.
 */
async function confirmarContratacao(
  companyId: string,
  sub: Stripe.Subscription,
  atual: { confirmacaoEnviadaEm: Date | null; name: string; email: string } | null,
): Promise<void> {
  if (!atual) return;
  if (!deveConfirmar(sub.status, atual.confirmacaoEnviadaEm)) return;

  try {
    const envio = await enviarEmail(
      atual.email,
      montarConfirmacao({
        nome: atual.name,
        emTeste: sub.status === "trialing",
        proximaCobranca: periodoFimDe(sub),
      }),
      // Sem link de descadastro, de propósito: ninguém pode optar por não
      // receber a confirmação do contrato que acabou de assinar.
    );

    // A marca só é gravada quando o envio deu certo. Se o Resend falhar hoje,
    // o próximo evento da Stripe tenta de novo — e é melhor tentar duas vezes
    // do que ficar sem a confirmação que o decreto exige.
    if (envio.enviado) {
      await prisma.company.update({
        where: { id: companyId },
        data: { confirmacaoEnviadaEm: new Date() },
      });
    }
  } catch (erro) {
    await logError("confirmacao-contratacao", erro, companyId);
  }
}

/** Re-busca a assinatura na Stripe e converge. */
export async function convergirAssinatura(subscriptionId: string): Promise<string | null> {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  return aplicarAssinatura(sub);
}

/**
 * Converge a partir de uma Checkout Session.
 *
 * Chamada dos DOIS lados: do webhook `checkout.session.completed` e da própria
 * página de retorno, quando ela recebe `session_id`. Ter os dois gatilhos é o
 * que impede o dono de pagar, cair no painel e ler "período de teste" porque o
 * webhook ainda não chegou — tela que informa o errado e não resolve.
 */
export async function convergirDoCheckout(sessionId: string): Promise<string | null> {
  const sessao = await stripe().checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  const companyId = companyIdDe(sessao);
  if (!companyId) return null;

  // Pagamento assíncrono ainda não compensado chega aqui como `unpaid`, e
  // liberar nesse ponto daria o mês de graça a quem só gerou a cobrança. Hoje
  // só cartão está ligado e este caminho é raro; a guarda existe para o dia em
  // que o boleto entrar, quando ele passa a ser o caso COMUM.
  if (!deveProvisionar(sessao)) return companyId;

  const sub = sessao.subscription;
  if (!sub || typeof sub === "string") {
    return sub ? convergirAssinatura(sub) : companyId;
  }
  return aplicarAssinatura(sub);
}

/**
 * Falha de pagamento. Escreve SOMENTE os contadores de dunning.
 *
 * Proibido tocar em subscriptionStatus ou plan: quem governa status é
 * `customer.subscription.*`. E a doc da Stripe é explícita que na PRIMEIRA
 * fatura a falha deixa a assinatura em `incomplete`, não em `past_due` — quem
 * grava `past_due` aqui codifica um estado que a Stripe não produziu.
 */
export async function registrarFalhaPagamento(
  companyId: string,
  motivo: string,
): Promise<void> {
  const atual = await prisma.company.findUnique({
    where: { id: companyId },
    select: { dunningIniciadoEm: true },
  });

  await prisma.company.update({
    where: { id: companyId },
    data: {
      falhasSeguidas: { increment: 1 },
      // O relógio da tolerância começa na PRIMEIRA falha e não é reiniciado
      // pelas seguintes — senão a tolerância nunca vence.
      dunningIniciadoEm: atual?.dunningIniciadoEm ?? new Date(),
      ultimoErroPagamento: motivo.slice(0, 300),
    },
  });
}
