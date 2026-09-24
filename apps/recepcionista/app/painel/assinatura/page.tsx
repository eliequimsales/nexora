import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionCompanyId } from "@/lib/auth";
import {
  estadoDaConta,
  podeExecutar,
  TOLERANCIA_DIAS,
  TRIAL_DIAS,
  type EstadoConta,
} from "@/lib/billing/acesso";
import { anualDaEmpresa } from "@/lib/billing/anual-da-conta";
import { convergirDoCheckout } from "@/lib/billing/converger";
import { GARANTIA_DIAS, ONDAS_MINIMAS, type SituacaoDaGarantia } from "@/lib/billing/garantia";
import { garantiaDaEmpresa } from "@/lib/billing/garantia-da-conta";
import {
  linkDoWhatsAppDeSuporte,
  MINUTOS_DA_CHAMADA,
  PRAZO_DA_IMPLANTACAO_DIAS,
} from "@/lib/billing/implantacao";
import { acoesDaConta, PLANOS, precoPendenteDoPlano, type PlanoId } from "@/lib/billing/planos";
import { emReais, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { garantirRelogio } from "@/lib/billing/relogio-da-conta";
import { variaveisPendentesDaStripe } from "@/lib/billing/stripe";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { linkDeSuporte } from "@/lib/institucional";
import { FORNECEDOR, variaveisPendentesDoFornecedor } from "@/lib/legal/identidade";
import { CartaoDoAnual } from "@/components/cobranca/cartao-do-anual";
import { BotaoBaixarApp } from "@/components/install-prompt";
import { BotoesAssinatura, type OpcaoDePlano } from "./botoes";
import { BotaoDaGarantia } from "./garantia";

export const dynamic = "force-dynamic";

/**
 * A CONTA.
 *
 * Regra Zero: esta tela não existe para exibir status. Ela existe para comparar
 * o que a Nexora TROUXE contra o que ela CUSTA, e terminar num botão. Painel de
 * assinatura que só mostra "plano: pro, próxima cobrança: dia 10" é vaidade.
 *
 * Verdade acima de marketing: quando ainda não há dado suficiente, a tela diz
 * isso na cara em vez de mostrar R$ 0,00 como se fosse fracasso, ou de esconder
 * o número.
 */

const reais = emReais;

const dataBr = (d: Date) =>
  d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });

/** Situações em que o dono ainda pode mudar o resultado — ou já pode pedir. */
const MOSTRA_PROGRESSO: SituacaoDaGarantia[] = [
  "EM_ANDAMENTO",
  "POUCAS_ONDAS",
  "SEM_RESPOSTA",
  "SE_PAGOU",
  "DISPONIVEL",
];

export default async function PaginaAssinatura({
  searchParams,
}: {
  searchParams: { session_id?: string; ok?: string; cancelado?: string };
}) {
  const companyId = await getSessionCompanyId();
  if (!companyId) redirect("/login");

  // Convergência pelo lado da página. O Checkout espera até 10s pelo webhook
  // antes de redirecionar, mas não garante que ele chegou — sem este segundo
  // gatilho o dono paga e lê "período de teste" na volta.
  if (searchParams.session_id) {
    try {
      await convergirDoCheckout(searchParams.session_id);
    } catch (erro) {
      await logError("assinatura-convergir", erro, companyId);
    }
  }

  const lida = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
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
  if (!lida) redirect("/login");

  const agora = new Date();
  // Conta antiga pode chegar aqui antes de passar por qualquer trava. Sem
  // garantir o relógio, esta tela diria "seu teste terminou" para quem ainda
  // tem os dias de aviso.
  const trialEndsAt = await garantirRelogio({ id: companyId, ...lida }, agora);
  const empresa = { ...lida, trialEndsAt };
  const estado = estadoDaConta(empresa, agora);

  // A mesma regra que a rota do checkout aplica: a tela nunca oferece um plano
  // que cobraria duas vezes quem já paga.
  const acoes = acoesDaConta({ estado, subscriptionStatus: empresa.subscriptionStatus });
  const planos = descricaoDosPlanos(estado);
  const aviso = avisoDoPrazo(estado, empresa);

  const planosEntrada: PlanoId[] = ["mensal_cartao", "pix_30_dias", "anual"];
  const opcoesEntrada = planosEntrada
    .filter((p) => acoes.planos.includes(p))
    .map((p) => planos[p]);

  const planosCompleto: PlanoId[] = ["completo_cartao", "completo_pix", "completo_anual"];
  const opcoesCompleto = planosCompleto
    .filter((p) => acoes.planos.includes(p))
    .map((p) => planos[p]);

  const [garantia, implantacao] = await Promise.all([
    garantiaDaEmpresa(companyId, agora),
    prisma.implantacao.findUnique({
      where: { companyId },
      select: { compradaEm: true, feitaEm: true },
    }),
  ]);

  // A implantação comprada é marcada pelo WhatsApp de suporte, lido na hora;
  // sem ele, pelo e-mail de atendimento.
  const whatsDaImplantacao = linkDoWhatsAppDeSuporte(
    process.env,
    `Oi! Comprei a implantação da Nexora para ${lida.name}. Quero marcar a chamada.`,
  );
  const linkDaImplantacao = whatsDaImplantacao ?? linkDeSuporte(FORNECEDOR);

  // O anual no momento da prova: só para quem paga mês a mês e já recuperou mais
  // que três mensalidades em 30 dias. Falha no cálculo não derruba a tela.
  const anual = await anualDaEmpresa(companyId, estado, agora).catch(() => null);

  const semGarantiaAinda = garantia.decisao.situacao === "SEM_GARANTIA";

  // Tudo que impede a cobrança de abrir, na ordem em que o dono resolve:
  // primeiro a Stripe e os preços de cada plano, depois a identificação exigida
  // pelo Decreto 7.962/2013. Nomes de variável, nunca valores.
  const precosPendentes = (Object.keys(PLANOS) as PlanoId[])
    .map((p) => precoPendenteDoPlano(p, process.env))
    .filter((nome): nome is string => nome !== null);
  const pendentes = Array.from(
    new Set([
      ...variaveisPendentesDaStripe(),
      ...precosPendentes,
      ...variaveisPendentesDoFornecedor(),
    ]),
  );

  // Voltou do checkout e o acesso ainda não liberou: quase sempre é o Pix que o
  // banco ainda não confirmou. Dizer isso — e dar o botão de conferir de novo —
  // evita o dono achar que pagou e não levou.
  const aguardandoPagamento = Boolean(searchParams.ok) && !podeExecutar(estado, "GERAR_ONDA").pode;
  const conferirDeNovo = searchParams.session_id
    ? `/painel/assinatura?ok=1&session_id=${encodeURIComponent(searchParams.session_id)}`
    : "/painel/assinatura?ok=1";

  return (
    <main className="max-w-5xl space-y-8">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl text-panel-ink">Planos</h1>
        <p className="mt-1 text-sm text-panel-sub">{RESUMO[estado](empresa, agora)}</p>
      </header>

      {searchParams.cancelado && (
        <p className="rounded-xl border border-panel-line bg-panel-card p-4 text-sm text-panel-sub">
          Pagamento não concluído. Nada foi cobrado, e sua conta continua como estava.
        </p>
      )}

      {aguardandoPagamento && (
        <p className="rounded-xl border border-panel-line bg-panel-card p-4 text-sm text-panel-sub">
          Recebemos seu pedido. Se você pagou no Pix, o banco confirma em instantes e o
          acesso libera sozinho.{" "}
          <Link href={conferirDeNovo} className="font-semibold text-panel-ink underline">
            Conferir agora
          </Link>
        </p>
      )}

      {aviso && (
        <p className="rounded-xl border border-amber/30 bg-amber/10 p-4 text-sm text-panel-ink">
          {aviso}
        </p>
      )}

      {pendentes.length > 0 && (
        <p className="rounded-xl bg-amber/20 p-4 text-sm text-[#7A5A10]">
          A cobrança ainda não está ligada nesta instalação. Nada será cobrado de você agora.
          Falta configurar: {pendentes.join(", ")}.
        </p>
      )}

      {/*
        OS DOIS PLANOS — COMPARATIVO LADO A LADO CONFORME O DESIGN APROVADO.
        Nexora (A Entrada) e Nexora Completo (Chega junto com o Plantão).
      */}
      <section aria-labelledby="titulo-planos" className="space-y-4">
        <h2 id="titulo-planos" className="sr-only">Planos da Nexora</h2>
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
          {/* CARD 1: NEXORA (A ENTRADA) */}
          <div className="relative flex flex-col justify-between rounded-3xl border-2 border-amber-500/80 bg-[#0B0F17] p-7 text-white shadow-xl shadow-amber-500/5 sm:p-8">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-400">
                  A ENTRADA
                </span>
              </div>

              <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Nexora
              </h3>

              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl tabular-nums">
                  R$ 97
                </span>
                <span className="text-sm font-medium text-gray-400">/mês</span>
              </div>

              <ul className="mt-6 space-y-3.5 text-sm text-gray-200">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 font-bold text-emerald-400" aria-hidden="true">✓</span>
                  <span>Recuperador: a Onda da semana com as mensagens prontas e o porquê de cada cliente</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 font-bold text-emerald-400" aria-hidden="true">✓</span>
                  <span>Dinheiro recuperado, com a prova de cada retorno</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 font-bold text-emerald-400" aria-hidden="true">✓</span>
                  <span>Agenda com link próprio, grade da equipe e lembretes anti-falta</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 font-bold text-emerald-400" aria-hidden="true">✓</span>
                  <span>WhatsApp conectado</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 font-bold text-emerald-400" aria-hidden="true">✓</span>
                  <span>Até 3 profissionais · clientes ilimitados</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 font-bold text-emerald-400" aria-hidden="true">✓</span>
                  <span>Garantia Dinheiro Recuperado na primeira contratação</span>
                </li>
              </ul>

              <div className="mt-8 border-t border-gray-800/80 pt-6">
                <BotoesAssinatura
                  opcoes={opcoesEntrada}
                  portal={acoes.portal}
                  comprouComSucesso={Boolean(searchParams.ok)}
                />
              </div>
            </div>

            <div className="mt-6 border-t border-gray-800/80 pt-4">
              <p className="text-xs text-gray-400">
                Pix, 30 dias: R$ 97 · Anual à vista: R$ 970 (paga 10, usa 12)
              </p>
            </div>
          </div>

          {/* CARD 2: NEXORA COMPLETO */}
          <div className="relative flex flex-col justify-between rounded-3xl border-2 border-amber-500/80 bg-[#0B0F17] p-7 text-white shadow-xl shadow-amber-500/5 sm:p-8">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-400">
                  MAIS VENDIDO · PLANTÃO 24/7
                </span>
              </div>

              <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Nexora Completo
              </h3>

              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl tabular-nums">
                  R$ 197
                </span>
                <span className="text-sm font-medium text-gray-400">/mês</span>
              </div>

              <ul className="mt-6 space-y-3.5 text-sm text-gray-200">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 font-bold text-emerald-400" aria-hidden="true">✓</span>
                  <span>Tudo do Nexora</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 font-bold text-emerald-400" aria-hidden="true">✓</span>
                  <span>O Plantão: atende o WhatsApp com a loja fechada e marca na agenda</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 font-bold text-emerald-400" aria-hidden="true">✓</span>
                  <span>Resumo da manhã e alerta de urgência no seu celular</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 font-bold text-emerald-400" aria-hidden="true">✓</span>
                  <span>Profissionais ilimitados</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 font-bold text-emerald-400" aria-hidden="true">✓</span>
                  <span>Primeiro da fila no suporte</span>
                </li>
              </ul>

              <div className="mt-8 border-t border-gray-800/80 pt-6">
                <BotoesAssinatura
                  opcoes={opcoesCompleto}
                  portal={acoes.portal}
                  comprouComSucesso={Boolean(searchParams.ok)}
                />
              </div>
            </div>

            <div className="mt-6 border-t border-gray-800/80 pt-4">
              <p className="text-xs text-gray-400">
                Pix, 30 dias: R$ 197 · Anual à vista: R$ 1.970 (paga 10, usa 12)
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SESSÃO: BAIXAR APLICATIVO */}
      <section className="rounded-2xl border border-panel-line bg-panel-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="text-sm font-medium uppercase tracking-wide text-panel-sub">
              Baixar Aplicativo
            </h2>
            <p className="mt-1 text-base font-semibold text-panel-ink">
              Instale a Nexora no seu celular ou computador
            </p>
            <p className="mt-1 text-sm text-panel-sub">
              Tenha acesso rápido na tela inicial do seu celular (Android e iPhone) ou no seu computador para acompanhar seus clientes e agendamentos.
            </p>
          </div>
          <BotaoBaixarApp
            rotulo="Baixar Aplicativo"
            className="rounded-xl bg-amber px-5 py-2.5 font-display text-sm font-bold text-night transition hover:brightness-110 active:scale-95 shadow-sm"
          />
        </div>
      </section>

      {/* SESSÃO: AGENDA INTELIGENTE */}
      <section className="rounded-2xl border border-panel-line bg-panel-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="text-sm font-medium uppercase tracking-wide text-panel-sub">
              Agenda Inteligente
            </h2>
            <p className="mt-1 text-base font-semibold text-panel-ink">
              Sua grade de horários e agendamentos automáticos
            </p>
            <p className="mt-1 text-sm text-panel-sub">
              Gerencie seus horários, equipe e serviços em um link exclusivo para clientes agendarem direto pelo WhatsApp sem conflito de horários.
            </p>
          </div>
          <Link
            href="/painel/agenda"
            className="rounded-xl bg-amber px-5 py-2.5 font-display text-sm font-bold text-night transition hover:brightness-110 active:scale-95 shadow-sm"
          >
            Abrir Agenda →
          </Link>
        </div>
      </section>

      {anual && <CartaoDoAnual oferta={anual} />}

      {/* Conexão do WhatsApp */}
      <section className="rounded-2xl border border-panel-line bg-panel-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wide text-panel-sub">
              Conexão do WhatsApp
            </h2>
            <p className="mt-1 text-sm text-panel-ink">
              Ligue o WhatsApp do seu negócio pelo QR Code para as mensagens da Onda saírem pelo seu número.
            </p>
          </div>
          <Link
            href="/painel/configuracoes"
            className="rounded-xl bg-amber px-4 py-2.5 font-display text-sm font-bold text-night transition hover:brightness-110"
          >
            Ligar meu WhatsApp
          </Link>
        </div>
      </section>

      {implantacao && (
        <section className="rounded-2xl border border-panel-line bg-panel-card p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-panel-sub">
            Implantação
          </h2>
          {implantacao.feitaEm ? (
            <p className="mt-3 text-panel-ink">Feita em {dataBr(implantacao.feitaEm)}.</p>
          ) : (
            <>
              <p className="mt-3 text-panel-ink">
                Comprada em {dataBr(implantacao.compradaEm)}. A chamada tem até{" "}
                {MINUTOS_DA_CHAMADA} minutos e acontece em até {PRAZO_DA_IMPLANTACAO_DIAS} dias
                da compra.
              </p>
              <a
                href={linkDaImplantacao}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-xl bg-amber px-4 py-2.5 text-sm font-semibold text-night transition hover:brightness-110"
              >
                {whatsDaImplantacao ? "Marcar pelo WhatsApp" : "Marcar por e-mail"}
              </a>
            </>
          )}
        </section>
      )}

      {!semGarantiaAinda && (
        <section id="garantia" className="rounded-2xl border border-panel-line bg-panel-card p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-panel-sub">
            Garantia Dinheiro Recuperado
          </h2>
          <p className="mt-3 text-panel-ink">{garantia.decisao.motivo}</p>

          {MOSTRA_PROGRESSO.includes(garantia.decisao.situacao) && (
            <ul className="mt-3 grid gap-1 text-sm text-panel-sub tabular-nums">
              <li>
                Ondas enviadas: {Math.min(garantia.sinais.ondas, ONDAS_MINIMAS)} de {ONDAS_MINIMAS}
              </li>
              <li>Dinheiro recuperado no período: {reais(garantia.sinais.recuperadoCents)}</li>
              {garantia.sinais.pendentesSemResposta > 0 && (
                <li>Contatos sem resposta marcada: {garantia.sinais.pendentesSemResposta}</li>
              )}
            </ul>
          )}

          {garantia.decisao.devolve ? (
            <BotaoDaGarantia />
          ) : (
            <Link
              href={garantia.decisao.acao.href}
              className="mt-4 inline-block rounded-xl border border-panel-line px-4 py-2.5 text-sm font-semibold text-panel-ink"
            >
              {garantia.decisao.acao.texto}
            </Link>
          )}
        </section>
      )}
    </main>
  );
}

type Empresa = {
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  acessoPagoAte: Date | null;
};

/**
 * Os três planos em palavras. Todo valor sai de PLANOS, que sai das constantes
 * de preço: um card anunciando um número diferente do cobrado é o dono
 * descobrindo a diferença na hora de pagar.
 */
function descricaoDosPlanos(estado: EstadoConta): Record<PlanoId, OpcaoDePlano> {
  const mensalidadesNoAnual = Math.round(PLANOS.anual.valorCents / PLANOS.mensal_cartao.valorCents);
  const mensalidadesNoCompletoAnual = Math.round(
    PLANOS.completo_anual.valorCents / PLANOS.completo_cartao.valorCents,
  );
  return {
    mensal_cartao: {
      plano: "mensal_cartao",
      titulo: "Mensal no cartão",
      preco: `${reais(PLANOS.mensal_cartao.valorCents)}/mês`,
      detalhe:
        "Renova sozinho todo mês. Cancele pelo painel, sem falar com ninguém, e fique até o fim do período pago.",
      acao: "Assinar no cartão",
    },
    pix_30_dias: {
      plano: "pix_30_dias",
      titulo: estado === "PASSE" ? "Mais 30 dias no Pix" : "30 dias no Pix",
      preco: reais(PLANOS.pix_30_dias.valorCents),
      detalhe:
        "Pagamento único, no Pix ou no cartão. Não renova sozinho: quando os 30 dias acabarem, você decide se paga de novo.",
      acao: "Pagar 30 dias",
    },
    anual: {
      plano: "anual",
      titulo: "Anual à vista",
      preco: reais(PLANOS.anual.valorCents),
      detalhe: `12 meses pelo preço de ${mensalidadesNoAnual} mensalidades, num pagamento só, no Pix ou no cartão.`,
      acao: "Pagar o ano",
    },
    completo_cartao: {
      plano: "completo_cartao",
      titulo: "Mensal no cartão",
      preco: `${reais(PLANOS.completo_cartao.valorCents)}/mês`,
      detalhe:
        "Renova sozinho todo mês. Inclui o Plantão 24/7 e profissionais ilimitados. Cancele pelo painel quando quiser.",
      acao: "Assinar no cartão",
    },
    completo_pix: {
      plano: "completo_pix",
      titulo: estado === "PASSE" ? "Mais 30 dias no Pix" : "30 dias no Pix",
      preco: reais(PLANOS.completo_pix.valorCents),
      detalhe:
        "Pagamento único de 30 dias com o Plantão 24/7 incluso, no Pix ou no cartão. Não renova sozinho.",
      acao: "Pagar 30 dias",
    },
    completo_anual: {
      plano: "completo_anual",
      titulo: "Anual à vista",
      preco: reais(PLANOS.completo_anual.valorCents),
      detalhe: `12 meses de Nexora Completo pelo preço de ${mensalidadesNoCompletoAnual} mensalidades, num pagamento só, no Pix ou no cartão.`,
      acao: "Pagar o ano",
    },
  };
}

/**
 * Quando a conta já tem dias pela frente, contratar agora precisa dizer o que
 * acontece com eles. "Não esconder limitações" vale para a letra miúda também.
 */
function avisoDoPrazo(estado: EstadoConta, e: Empresa): string | null {
  if (estado === "TRIAL" && e.trialEndsAt) {
    return (
      `Seu teste grátis vai até ${dataBr(e.trialEndsAt)}, e contratar agora não encurta esses dias: ` +
      "no cartão, a primeira cobrança só acontece quando o teste acabar; no Pix e no anual, você " +
      "paga hoje e os dias pagos começam depois do teste."
    );
  }
  if (estado === "PASSE" && e.acessoPagoAte) {
    return (
      `Seus dias pagos vão até ${dataBr(e.acessoPagoAte)}. Pagando mais agora, os dias novos ` +
      "começam depois dessa data. A assinatura no cartão fica disponível quando esses dias acabarem."
    );
  }
  if (estado === "CANCELADO_COM_ACESSO" && e.currentPeriodEnd) {
    return (
      `Você tem acesso até ${dataBr(e.currentPeriodEnd)}. No Pix e no anual, os dias pagos começam ` +
      "depois dessa data; a assinatura no cartão começa a cobrar no dia em que você assinar."
    );
  }
  return null;
}

const RESUMO: Record<EstadoConta, (e: Empresa, agora: Date) => string> = {
  // Quem nunca teve teste não pode ler "seu teste terminou".
  GRATIS: () =>
    "Plano gratuito: o diagnóstico, a importação e a exportação da sua lista são livres, e " +
    "a primeira Onda é por nossa conta. Para as próximas, escolha um plano.",
  TRIAL: (e) =>
    e.trialEndsAt
      ? `Você está no período de teste, até ${dataBr(e.trialEndsAt)}. Nada foi cobrado.`
      : `Você está no período de teste de ${TRIAL_DIAS} dias. Nada foi cobrado.`,
  TRIAL_EXPIRADO: () =>
    "Seu período de teste terminou. Sua base e seu histórico continuam aqui, inteiros.",
  ATIVO: (e) =>
    e.cancelAtPeriodEnd && e.currentPeriodEnd
      ? `Assinatura cancelada. Você tem acesso até ${dataBr(e.currentPeriodEnd)}.`
      : e.currentPeriodEnd
        ? `Assinatura ativa. Próxima cobrança em ${dataBr(e.currentPeriodEnd)}.`
        : "Assinatura ativa.",
  // Passe não é assinatura: sem "próxima cobrança", porque não existe uma.
  PASSE: (e) =>
    e.acessoPagoAte
      ? `Acesso pago até ${dataBr(e.acessoPagoAte)}. Não há cobrança automática.`
      : "Acesso pago, sem cobrança automática.",
  TOLERANCIA: () =>
    `O último pagamento não passou. Você tem ${TOLERANCIA_DIAS} dias de acesso normal para resolver.`,
  BLOQUEADO: () =>
    "O pagamento não foi regularizado e o envio de novas ondas está parado. Seus dados estão intactos.",
  CANCELADO_COM_ACESSO: (e) =>
    e.currentPeriodEnd
      ? `Cancelada. Seu acesso vai até ${dataBr(e.currentPeriodEnd)}.`
      : "Cancelada, com acesso até o fim do período pago.",
  CANCELADO: () =>
    "Assinatura cancelada. Seus dados continuam seus: você pode ler e exportar quando quiser.",
};
