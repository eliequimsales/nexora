import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { estadoDaConta } from "@/lib/billing/acesso";
import {
  lerPlano,
  parametrosDoCheckout,
  planoDisponivel,
  PLANOS,
  precoPendenteDoPlano,
} from "@/lib/billing/planos";
import { implantacaoParaOCheckout } from "@/lib/billing/implantacao-da-conta";
import { ofertaDaEmpresa } from "@/lib/billing/oferta-da-conta";
import { fimDoTrialNoCheckout } from "@/lib/billing/relogio";
import { garantirRelogio } from "@/lib/billing/relogio-da-conta";
import { stripe, stripeConfigurado, variaveisPendentesDaStripe } from "@/lib/billing/stripe";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { identificacaoCompleta, variaveisPendentesDoFornecedor } from "@/lib/legal/identidade";
import { rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { podeCobrar } from "@/lib/auth/verificacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Abre o Checkout hospedado da Stripe para um dos três planos.
 *
 * Hospedado, e não Payment Element, porque o Checkout já entrega em pt-BR:
 * cartão com 3DS, QR do Pix com prazo, atualização de cartão quando a renovação
 * falha, e mantém a operação em PCI SAQ-A. Cada uma dessas telas feita à mão é
 * uma semana que não vira Receita Recuperada.
 *
 * O Pix só existe nos planos avulsos (30 dias e anual): a Stripe no Brasil não
 * faz Pix recorrente — o Pix Automático não está disponível para contas BR.
 */
export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // O plano vem do botão. Corpo vazio é o mensal, que é o que o botão antigo
  // manda; plano que não existe é recusado, nunca trocado por outro em silêncio.
  const plano = lerPlano(await request.json().catch(() => null));
  if (!plano) {
    return NextResponse.json(
      { error: "Esse plano não existe. Escolha um dos planos da tela Minha conta." },
      { status: 400 },
    );
  }

  // O erro diz o NOME do que falta, nunca o valor.
  //
  // Quem lê esta mensagem está logado na própria conta e, nesta fase, é o
  // próprio dono da instalação. "Fale com a gente" mandava ele abrir um chamado
  // para si mesmo; o nome da variável é uma tarefa de trinta segundos no painel
  // do Railway. Nome de variável não é segredo — valor é, e nenhum sai daqui.
  if (!stripeConfigurado()) {
    return NextResponse.json(
      {
        error:
          "A cobrança ainda não está ligada: falta configurar " +
          `${variaveisPendentesDaStripe().join(" e ")} no serviço.`,
      },
      { status: 503 },
    );
  }

  // Cada plano tem o próprio preço na Stripe. Faltando o do plano escolhido, a
  // resposta diz qual — e os outros planos continuam funcionando.
  const precoPendente = precoPendenteDoPlano(plano, process.env);
  if (precoPendente) {
    return NextResponse.json(
      { error: `Este plano ainda não está ligado: falta configurar ${precoPendente} no serviço.` },
      { status: 503 },
    );
  }

  // TRAVA LEGAL, e não lembrete.
  //
  // O Decreto 7.962/2013, art. 2º exige nome, CPF ou CNPJ e endereço do
  // fornecedor em destaque ANTES de qualquer cobrança. Enquanto a
  // identificação estiver incompleta, cobrar é irregular — e o e-mail de
  // confirmação sairia com lacuna no lugar de quem cobrou.
  //
  // A checagem mora aqui, no único caminho que cria cobrança, para que isso
  // seja impossível em vez de ser algo que alguém precisa lembrar.
  if (!identificacaoCompleta()) {
    const faltando = variaveisPendentesDoFornecedor();
    await logError(
      "checkout-bloqueado-identificacao",
      new Error(`Identificação do fornecedor incompleta: ${faltando.join(", ")}`),
      companyId,
    );
    return NextResponse.json(
      {
        error:
          "Antes de cobrar, a lei exige nome, CPF/CNPJ e endereço de quem presta o " +
          `serviço. Falta configurar: ${faltando.join(", ")}.`,
      },
      { status: 503 },
    );
  }

  if (!rateLimit(`checkout:${companyId}`, { limit: 10, windowMs: 10 * 60_000 })) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const empresa = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        email: true,
        stripeCustomerId: true,
        emailVerificadoEm: true,
        createdAt: true,
        termosVersao: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        dunningIniciadoEm: true,
        acessoPagoAte: true,
      },
    });
    if (!empresa) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

    // Antes de tirar dinheiro de alguém é preciso saber que dá para falar com
    // essa pessoa — e o Decreto 7.962/2013 obriga a mandar o comprovante da
    // contratação para o e-mail dela. Cobrar de um endereço não comprovado é
    // cobrar sem conseguir cumprir a obrigação que vem junto.
    const cobranca = podeCobrar(empresa);
    if (!cobranca.pode) {
      return NextResponse.json({ error: cobranca.motivo }, { status: 403 });
    }

    const agora = new Date();
    const trialEndsAt = await garantirRelogio(empresa, agora);

    // Três planos convivendo abrem um jeito novo de cobrar duas vezes: vender o
    // Pix para quem já paga no cartão, ou uma segunda assinatura para quem já tem
    // uma. A regra é a mesma que desenha os botões da tela, e a recusa vem antes
    // de qualquer escrita na Stripe.
    const disponivel = planoDisponivel({
      plano,
      estado: estadoDaConta({ ...empresa, trialEndsAt }, agora),
      subscriptionStatus: empresa.subscriptionStatus,
    });
    if (!disponivel.pode) {
      return NextResponse.json({ error: disponivel.motivo }, { status: 409 });
    }

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

    // O TRIAL DA STRIPE TERMINA NO DIA DO RELÓGIO DA CONTA.
    //
    // Antes a sessão pedia 30 dias contados do CLIQUE: quem usava o mês grátis
    // e só então abria o checkout ganhava outro mês inteiro. Os Termos prometem
    // os primeiros 30 dias, não 30 dias a partir de quando a pessoa decidir.
    // Teste vencido assina cobrando na hora.
    //
    // Teste só existe na assinatura. O passe é pago na hora e começa a contar
    // quando o acesso atual acabar (lib/billing/passe.ts).
    const fimDoTrial =
      PLANOS[plano].modo === "subscription" ? fimDoTrialNoCheckout(trialEndsAt, agora) : null;

    // GARANTIA DINHEIRO RECUPERADO: vale para lista acima do Corte Honesto, e o
    // que conta é a lista NA COMPRA. Se a conta não fechar por erro nosso, a
    // garantia vai junto: a tela de planos a anunciou, e uma falha daqui não pode
    // tirá-la de quem pagou.
    const garantia = await ofertaDaEmpresa(companyId)
      .then((oferta) => !oferta.corteHonesto)
      .catch(async (erro) => {
        await logError("checkout-oferta-garantia", erro, companyId);
        return true;
      });

    // A IMPLANTAÇÃO, opcional, na mesma tela de pagamento. Oferecida só quando a
    // regra deixa (lib/billing/implantacao.ts), e nunca derruba o checkout.
    const implantacao = await implantacaoParaOCheckout(companyId, fimDoTrial !== null, agora);

    const sessao = await stripe().checkout.sessions.create(
      parametrosDoCheckout({
        plano,
        customerId,
        companyId,
        appUrl,
        fimDoTrial,
        garantia,
        env: process.env,
        implantacao,
      }),
    );

    // Carrinho abandonado: marca a intenção AGORA. Quem chegou até aqui e não
    // voltou é a lista mais quente que existe, e sem esta marca não há como
    // saber quem foi. É apagada quando a assinatura nasce ou o passe é pago.
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
