/**
 * CONVERGÊNCIA DO ESTADO DA ASSINATURA E DO PASSE.
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
 * currentPeriodEnd e trialEndsAt; só `aplicarPasse` e `encerrarAcessoPago` tocam
 * em acessoPagoAte. Falha de pagamento NÃO escreve status — dois escritores no
 * mesmo campo é como o estado da conta começa a mentir.
 */

import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { companyIdDe, deveProvisionar, fimDoPeriodoPago, periodoFimDe } from "./eventos";
import { stripe } from "./stripe";
import { deveConfirmar, montarConfirmacao, montarConfirmacaoDoPasse } from "./confirmacao";
import { diasDoPasse, fimDoAcessoAtual, periodoDoPasse } from "./passe";
import { enviarEmail } from "@/lib/reengajamento/email";
import { logError } from "@/lib/errors";

function paraData(seg: number | null | undefined): Date | null {
  return typeof seg === "number" && Number.isFinite(seg) ? new Date(seg * 1000) : null;
}

function idDe(alvo: string | { id: string } | null | undefined): string | null {
  if (!alvo) return null;
  return typeof alvo === "string" ? alvo : alvo.id;
}

/** "sim" ou "nao" quando a compra passou pelo checkout com garantia; null antes dela existir. */
function marcaDaGarantia(metadata: Stripe.Metadata | null | undefined): boolean | null {
  const marca = metadata?.garantia;
  if (marca === "sim") return true;
  if (marca === "nao") return false;
  return null;
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
      // Encerrada, termina quando acabou — não no fim de um mês que ninguém pagou.
      currentPeriodEnd: fimDoPeriodoPago(sub),
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

  await registrarGarantiaDaAssinatura(companyId, sub);
  await confirmarContratacao(companyId, sub, atual);

  return companyId;
}

/**
 * A GARANTIA NASCE NO PRIMEIRO PAGAMENTO.
 *
 * Só para assinatura aberta pelo checkout com garantia, que carrega a marca no
 * metadata: quem assinou antes aceitou Termos sem devolução. O período começa
 * quando a assinatura fica ativa — no teste, isso é o fim do teste, que é quando
 * o primeiro dinheiro sai.
 *
 * `createMany` com `skipDuplicates` porque este handler roda a cada evento da
 * Stripe e a garantia é uma por negócio: a primeira compra vale, as seguintes não
 * mexem nela.
 */
async function registrarGarantiaDaAssinatura(
  companyId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const acimaDoCorte = marcaDaGarantia(sub.metadata);
  if (sub.status !== "active" || acimaDoCorte === null) return;

  await prisma.garantia.createMany({
    data: [{ companyId, inicio: new Date(), acimaDoCorte }],
    skipDuplicates: true,
  });
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

const SELECAO_DO_PASSE = {
  id: true,
  dias: true,
  valorCents: true,
  fim: true,
  confirmacaoEnviadaEm: true,
} as const;

type PasseGravado = {
  id: string;
  dias: number;
  valorCents: number;
  fim: Date;
  confirmacaoEnviadaEm: Date | null;
};

/**
 * O PASSE PAGO: pagamento avulso — 30 dias no Pix ou anual — que compensou.
 *
 * Só chega aqui depois de `deveProvisionar`: o Pix gerado e ainda não pago volta
 * `unpaid` e não libera nada.
 *
 * UMA VEZ POR SESSÃO. O `create` do PassePago é a reivindicação: o webhook e a
 * página de retorno convergem a mesma compra ao mesmo tempo, e a segunda
 * execução estoura na sessão única em vez de somar mais dias. O prazo da conta
 * é gravado na MESMA transação — passe registrado sem prazo, ou prazo sem
 * registro, seria cobrança sem entrega ou entrega sem prova.
 *
 * O período novo começa quando o acesso que a conta já tem acaba: pagar cedo
 * não custa os dias do teste, de uma assinatura cancelada ou de um passe que
 * ainda vale.
 */
export async function aplicarPasse(
  companyId: string,
  sessao: Stripe.Checkout.Session,
): Promise<string> {
  const dias = diasDoPasse(sessao.metadata);
  if (!dias) {
    // Pagou e não dá para saber quantos dias comprou. Inventar prazo é pior do
    // que não liberar: o erro vai para o ErrorLog, com a sessão, para alguém
    // resolver olhando o pagamento na Stripe.
    await logError(
      "passe-sem-prazo",
      new Error(`Sessão ${sessao.id} paga sem passeDias válido no metadata`),
      companyId,
    );
    return companyId;
  }

  const agora = new Date();
  const acimaDoCorte = marcaDaGarantia(sessao.metadata);

  let passe: PasseGravado;
  try {
    passe = await prisma.$transaction(async (tx) => {
      const empresa = await tx.company.findUnique({
        where: { id: companyId },
        select: {
          subscriptionStatus: true,
          trialEndsAt: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          dunningIniciadoEm: true,
          acessoPagoAte: true,
        },
      });
      if (!empresa) throw new Error(`Passe ${sessao.id} pago para uma empresa que não existe`);

      const { inicio, fim } = periodoDoPasse({
        acessoAte: fimDoAcessoAtual(empresa, agora),
        agora,
        dias,
      });

      const criado = await tx.passePago.create({
        data: {
          companyId,
          stripeSessionId: sessao.id,
          stripePaymentIntentId: idDe(sessao.payment_intent),
          plano: sessao.metadata?.plano ?? "",
          dias,
          valorCents: sessao.amount_total ?? 0,
          inicio,
          fim,
        },
        select: SELECAO_DO_PASSE,
      });

      // Trava otimista. Se outra compra da MESMA conta mudou o prazo entre a
      // leitura e aqui, nada é gravado e a reentrega recalcula a partir do fim
      // novo. Sem isto, duas compras simultâneas começariam do mesmo dia e os
      // dias de uma delas sumiriam.
      const gravou = await tx.company.updateMany({
        where: { id: companyId, acessoPagoAte: empresa.acessoPagoAte },
        data: {
          acessoPagoAte: fim,
          // Pagou: não abandonou carrinho nenhum e não é mais quem cancelou.
          checkoutAbertoEm: null,
          canceladoEm: null,
        },
      });
      if (gravou.count === 0) {
        throw new Error(`O prazo pago mudou durante a gravação do passe ${sessao.id}; a reentrega recalcula`);
      }

      // A garantia nasce no primeiro pagamento com ela, junto com o prazo: se a
      // transação desfaz, nada disto fica. O período dela é o período pago —
      // quem pagou durante o teste começa a contar quando o teste acaba.
      if (acimaDoCorte !== null) {
        await tx.garantia.createMany({
          data: [{ companyId, inicio, acimaDoCorte }],
          skipDuplicates: true,
        });
      }

      return criado;
    });
  } catch (erro) {
    if ((erro as { code?: string })?.code !== "P2002") throw erro;

    // Esta compra já virou passe em outra execução. Não soma nada: só confere
    // se a confirmação ficou para trás.
    const existente = await prisma.passePago.findUnique({
      where: { stripeSessionId: sessao.id },
      select: SELECAO_DO_PASSE,
    });
    if (!existente) throw erro;
    passe = existente;
  }

  await confirmarPasse(companyId, passe);
  return companyId;
}

/**
 * A garantia devolveu o dinheiro: o acesso pago acaba agora. Mora aqui porque
 * `acessoPagoAte` tem escritor único, e porque o próximo passe comprado precisa
 * começar do zero, sem os dias que foram devolvidos.
 */
export async function encerrarAcessoPago(companyId: string, agora: Date): Promise<void> {
  await prisma.company.updateMany({
    where: { id: companyId, acessoPagoAte: { gt: agora } },
    data: { acessoPagoAte: agora },
  });
}

/**
 * Confirmação do passe — mesma obrigação da assinatura, e as mesmas duas regras:
 * nunca derruba a gravação do acesso, e sai uma vez só.
 *
 * Aqui a vez de mandar é reivindicada ANTES do envio. No passe pago no cartão, o
 * webhook e a página de retorno chegam no mesmo segundo; marcando só depois, os
 * dois leriam "não enviada" e o dono receberia o comprovante em dobro. Se o envio
 * falhar, a vez é devolvida e a próxima convergência desta compra tenta de novo.
 */
async function confirmarPasse(companyId: string, passe: PasseGravado): Promise<void> {
  if (passe.confirmacaoEnviadaEm) return;

  let reivindicou = false;
  try {
    const vez = await prisma.passePago.updateMany({
      where: { id: passe.id, confirmacaoEnviadaEm: null },
      data: { confirmacaoEnviadaEm: new Date() },
    });
    if (vez.count === 0) return;
    reivindicou = true;

    const empresa = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, email: true },
    });
    if (empresa) {
      const envio = await enviarEmail(
        empresa.email,
        montarConfirmacaoDoPasse({
          nome: empresa.name,
          dias: passe.dias,
          valorCents: passe.valorCents,
          fim: passe.fim,
        }),
      );
      if (envio.enviado) return;
    }
  } catch (erro) {
    await logError("confirmacao-passe", erro, companyId);
  }

  if (reivindicou) {
    await prisma.passePago
      .update({ where: { id: passe.id }, data: { confirmacaoEnviadaEm: null } })
      .catch((erro) => logError("confirmacao-passe-devolver-vez", erro, companyId));
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
 * Chamada dos DOIS lados: dos webhooks do checkout e da própria página de
 * retorno, quando ela recebe `session_id`. Ter os dois gatilhos é o que impede o
 * dono de pagar, cair no painel e ler "período de teste" porque o webhook ainda
 * não chegou — tela que informa o errado e não resolve.
 */
export async function convergirDoCheckout(sessionId: string): Promise<string | null> {
  const sessao = await stripe().checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  const companyId = companyIdDe(sessao);
  if (!companyId) return null;

  // Pagamento assíncrono ainda não compensado chega aqui como `unpaid`: é o Pix
  // com o QR gerado e ainda não pago. Liberar nesse ponto daria os dias de graça
  // a quem só gerou a cobrança. Quando o banco confirma, chega
  // `checkout.session.async_payment_succeeded` e esta função roda de novo.
  if (!deveProvisionar(sessao)) return companyId;

  // Pagamento avulso não tem assinatura: é o passe de 30 dias ou o anual.
  if (sessao.mode === "payment") return aplicarPasse(companyId, sessao);

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
