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
import { convergirDoCheckout } from "@/lib/billing/converger";
import { GARANTIA_DIAS, ONDAS_MINIMAS, type SituacaoDaGarantia } from "@/lib/billing/garantia";
import { garantiaDaEmpresa } from "@/lib/billing/garantia-da-conta";
import { ofertaDaEmpresa } from "@/lib/billing/oferta-da-conta";
import { acoesDaConta, PLANOS, precoPendenteDoPlano, type PlanoId } from "@/lib/billing/planos";
import { emReais, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { garantirRelogio } from "@/lib/billing/relogio-da-conta";
import { variaveisPendentesDaStripe } from "@/lib/billing/stripe";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { variaveisPendentesDoFornecedor } from "@/lib/legal/identidade";
import { MIN_RECUPERAVEL_CENTS, MIN_SUMIDOS } from "@/lib/recuperacao/estimativa";
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

  // North Star: Receita Recuperada COMPROVADA. Só o que foi atribuído — o resto
  // vai numa linha separada, nunca somado, para o número não inflar.
  const [comprovado, semAtribuicao, garantia] = await Promise.all([
    prisma.recoveryEntry.aggregate({
      where: { companyId, attributed: true },
      _sum: { valueCents: true },
      _count: true,
    }),
    prisma.recoveryEntry.aggregate({
      where: { companyId, attributed: false },
      _sum: { valueCents: true },
      _count: true,
    }),
    garantiaDaEmpresa(companyId, agora),
  ]);

  // A garantia que uma compra NOVA levaria. Só existe enquanto a conta não tem a
  // dela (é uma por negócio), e usa a mesma conta do checkout: a tela não pode
  // prometer a garantia que a compra não vai carregar.
  const semGarantiaAinda = garantia.decisao.situacao === "SEM_GARANTIA";
  const ofertaDeHoje =
    semGarantiaAinda && acoes.planos.length > 0
      ? await ofertaDaEmpresa(companyId, agora).catch(() => null)
      : null;
  const compraSemGarantia = Boolean(ofertaDeHoje?.corteHonesto);

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

  const recuperadoCents = comprovado._sum.valueCents ?? 0;
  const clientesDeVolta = comprovado._count;
  const vezes = recuperadoCents / PRECO_MENSAL_CENTS;

  // Voltou do checkout e o acesso ainda não liberou: quase sempre é o Pix que o
  // banco ainda não confirmou. Dizer isso — e dar o botão de conferir de novo —
  // evita o dono achar que pagou e não levou.
  const aguardandoPagamento = Boolean(searchParams.ok) && !podeExecutar(estado, "GERAR_ONDA").pode;
  const conferirDeNovo = searchParams.session_id
    ? `/painel/assinatura?ok=1&session_id=${encodeURIComponent(searchParams.session_id)}`
    : "/painel/assinatura?ok=1";

  return (
    <main className="max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-2xl text-panel-ink">Minha conta</h1>
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

      {/* O placar. É o argumento inteiro da assinatura em um bloco. */}
      <section className="rounded-2xl border border-panel-line bg-panel-card p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-panel-sub">
          O que a Nexora já trouxe de volta
        </h2>

        {clientesDeVolta === 0 ? (
          <>
            <p className="mt-3 text-panel-ink">
              Ainda não há retorno comprovado para mostrar.
            </p>
            <p className="mt-2 text-sm text-panel-sub">
              O número aparece aqui quando você marcar na Onda que alguém voltou. Enquanto
              isso não acontece, a gente não tem o que provar — e não vai inventar.
            </p>
          </>
        ) : (
          <>
            <p className="mt-3 font-display text-4xl text-panel-ink tabular-nums">
              {reais(recuperadoCents)}
            </p>
            {/* Frase inteira nas duas formas: "voltou" + "ram" dá "voltouram". */}
            <p className="mt-2 text-sm text-panel-sub">
              {clientesDeVolta === 1
                ? "1 cliente que tinha sumido e voltou"
                : `${clientesDeVolta} clientes que tinham sumido e voltaram`}{" "}
              depois de uma mensagem da Onda, dentro da janela de atribuição de 21 dias.
            </p>
            <p className="mt-3 rounded-xl bg-panel-bg p-3 text-sm text-panel-ink">
              Isso é <strong>{vezes.toFixed(1)}x</strong> o valor da mensalidade de{" "}
              {reais(PRECO_MENSAL_CENTS)}.
            </p>
            {semAtribuicao._count > 0 && (
              <p className="mt-3 text-xs text-panel-sub">
                Outros {semAtribuicao._count} clientes voltaram fora da janela de
                atribuição ({reais(semAtribuicao._sum.valueCents ?? 0)}). Não somamos esse
                valor porque não dá para afirmar que foi a Nexora que trouxe.
              </p>
            )}
          </>
        )}
      </section>

      <section className="rounded-2xl border border-panel-line bg-panel-card p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-panel-sub">
          {acoes.planos.length > 0 ? "Planos" : "Sua assinatura"}
        </h2>

        {acoes.planos.length > 0 ? (
          <p className="mt-2 text-sm text-panel-sub">
            Todos com a Nexora completa e impostos inclusos. A diferença é só como você paga.
          </p>
        ) : (
          <p className="mt-2 text-panel-ink">
            <span className="font-display text-2xl">{reais(PLANOS.mensal_cartao.valorCents)}</span>
            <span className="text-sm text-panel-sub"> /mês no cartão, impostos inclusos</span>
          </p>
        )}

        {aviso && <p className="mt-3 text-sm text-panel-ink">{aviso}</p>}

        {/* O que a próxima compra leva — dito antes do pagamento, nunca depois. */}
        {semGarantiaAinda && acoes.planos.length > 0 && (
          <p className="mt-3 rounded-xl bg-panel-bg p-3 text-sm text-panel-ink">
            {compraSemGarantia
              ? `Pela sua lista de hoje — menos de ${MIN_SUMIDOS} clientes sumidos ou de ` +
                `${reais(MIN_RECUPERAVEL_CENTS)} para recuperar —, esta contratação não inclui a ` +
                "Garantia Dinheiro Recuperado."
              : `Garantia Dinheiro Recuperado: se em ${GARANTIA_DIAS} dias você mandar as mensagens de ` +
                `${ONDAS_MINIMAS} ondas, marcar quem voltou e o Dinheiro recuperado não chegar a ` +
                `${reais(PRECO_MENSAL_CENTS)}, devolvemos tudo o que você pagou. Vale uma vez por negócio.`}
          </p>
        )}

        {/*
          O que falta, pelo nome. São NOMES de variável, nunca valores, e a tela
          só existe para quem já está logado na própria conta. Enquanto isso ficava
          em "fale com a gente", o dono da instalação abria um chamado para si
          mesmo em vez de resolver em trinta segundos no painel do Railway.
        */}
        {pendentes.length > 0 && (
          <p className="mt-4 rounded-xl bg-amber/20 p-3 text-sm text-[#7A5A10]">
            A cobrança ainda não está ligada nesta instalação. Nada será cobrado de você
            agora. Falta configurar: {pendentes.join(", ")}.
          </p>
        )}

        {/*
          Os botões continuam clicáveis de propósito. Desabilitados, eles nunca
          chamam a API — e a mensagem que diz exatamente o que falta morre sem
          nunca chegar à tela. Quem clica sem a cobrança ligada recebe o motivo;
          nada é cobrado porque o checkout recusa antes de criar sessão.
        */}
        <BotoesAssinatura
          opcoes={acoes.planos.map((p) => planos[p])}
          portal={acoes.portal}
          comprouComSucesso={Boolean(searchParams.ok)}
        />
      </section>

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
    "Plano gratuito: o diagnóstico, a importação e a exportação da sua lista são livres. " +
    "Para liberar as mensagens prontas, escolha um plano.",
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
