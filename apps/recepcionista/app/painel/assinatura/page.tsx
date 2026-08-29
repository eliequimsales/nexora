import { redirect } from "next/navigation";
import { getSessionCompanyId } from "@/lib/auth";
import { estadoDaConta, TOLERANCIA_DIAS, TRIAL_DIAS } from "@/lib/billing/acesso";
import { convergirDoCheckout } from "@/lib/billing/converger";
import { emReais, PRECO_LISTA_CENTS } from "@/lib/billing/preco";
import { stripeConfigurado } from "@/lib/billing/stripe";
import { contarAssinantes, precoAtual } from "@/lib/billing/vagas";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { BotoesAssinatura } from "./botoes";

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
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

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

  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      subscriptionStatus: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      dunningIniciadoEm: true,
      stripeCustomerId: true,
    },
  });
  if (!empresa) redirect("/login");

  const agora = new Date();
  const estado = estadoDaConta(empresa, agora);

  // North Star: Receita Recuperada COMPROVADA. Só o que foi atribuído — o resto
  // vai numa linha separada, nunca somado, para o número não inflar.
  const [comprovado, semAtribuicao] = await Promise.all([
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
  ]);

  const recuperadoCents = comprovado._sum.valueCents ?? 0;
  const clientesDeVolta = comprovado._count;

  // O preço que ESTE dono paga: quem já assinou mantém o dele; quem ainda não
  // vê o que valeria agora.
  const preco = precoAtual(await contarAssinantes());
  const vezes = recuperadoCents / preco.cents;

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
            <p className="mt-2 text-sm text-panel-sub">
              {clientesDeVolta} cliente{clientesDeVolta > 1 ? "s" : ""} que tinha
              {clientesDeVolta > 1 ? "m" : ""} sumido e voltou
              {clientesDeVolta > 1 ? "ram" : ""} depois de uma mensagem da Onda, dentro da
              janela de atribuição de 21 dias.
            </p>
            <p className="mt-3 rounded-xl bg-panel-bg p-3 text-sm text-panel-ink">
              Isso é <strong>{vezes.toFixed(1)}x</strong> o valor da mensalidade de{" "}
              {reais(preco.cents)}.
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
          Plano
        </h2>
        <p className="mt-2 text-panel-ink">
          <span className="font-display text-2xl">{reais(preco.cents)}</span>
          <span className="text-sm text-panel-sub"> /mês, impostos inclusos</span>
          {preco.fundador && (
            <span className="ml-2 text-sm text-panel-sub line-through">
              {reais(PRECO_LISTA_CENTS)}
            </span>
          )}
        </p>

        {/* Escassez contada pelo banco. Se um dia esse número for escrito à mão,
            vira a publicidade enganosa que a Constituição proíbe. */}
        {preco.fundador && (
          <p className="mt-2 rounded-xl bg-amber/20 p-3 text-sm text-[#7A5A10]">
            <strong>
              Preço de fundador: {preco.vagasRestantes} vaga
              {preco.vagasRestantes > 1 ? "s" : ""} de {20}.
            </strong>{" "}
            Quem entra agora paga {reais(preco.cents)} para sempre, mesmo depois que o
            preço subir. Em troca, pedimos seu depoimento depois de 60 dias — só se a
            Nexora tiver funcionado para você.
          </p>
        )}

        <p className="mt-2 text-sm text-panel-sub">
          Cartão ou boleto. Cancele quando quiser — você fica com o período que já pagou.
        </p>

        {!stripeConfigurado() && (
          <p className="mt-4 rounded-xl bg-amber/20 p-3 text-sm text-[#7A5A10]">
            A cobrança ainda não está ligada nesta instalação. Nada será cobrado de você
            agora.
          </p>
        )}

        <BotoesAssinatura
          estado={estado}
          temAssinatura={Boolean(empresa.stripeCustomerId)}
          habilitado={stripeConfigurado()}
          precoTexto={reais(preco.cents)}
        />
      </section>
    </main>
  );
}

type Empresa = {
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

const RESUMO: Record<string, (e: Empresa, agora: Date) => string> = {
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
