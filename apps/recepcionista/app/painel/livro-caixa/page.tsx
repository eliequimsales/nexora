import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { emReais } from "@/lib/billing/preco";
import { CartaoRetorno } from "@/components/painel/cartao-retorno";
import { inicioDoMes, retornoDaAssinatura } from "@/lib/painel/retorno";

export const dynamic = "force-dynamic";

/** Quantas linhas o extrato MOSTRA. Não tem relação com os totais. */
const LINHAS_NO_EXTRATO = 200;

/**
 * LIVRO-CAIXA — a prova de que a Nexora se paga.
 *
 * SOMA NO BANCO, LISTA NA TELA. Antes, os dois totais eram somados em memória
 * sobre as mesmas 200 linhas do extrato: passando de 200 retornos, o acumulado
 * parava de crescer e divergia de /painel/assinatura, que agrega sem limite. O
 * dono via dois valores para o mesmo dinheiro em duas telas do mesmo produto —
 * e esse número agora é o destaque da página. Agregação e listagem viraram
 * consultas separadas de propósito.
 *
 * SEM GRÁFICO, de propósito: aqui é extrato, cada linha é um retorno que
 * aconteceu, e o número é conferível contra o caixa dele.
 */
export default async function LivroCaixaPage() {
  const companyId = await getSessionCompanyId();
  if (!companyId) redirect("/login");

  // O recorte do mês mora em lib/painel/retorno.ts (fuso fixo em UTC-3, porque
  // o Brasil não tem mais horário de verão). Uma segunda cópia da conta faria
  // "este mês" significar coisas diferentes em duas telas do mesmo produto.
  const comecoDoMes = inicioDoMes();

  const [mes, acumulado, totalDeEntradas, extrato, aguardando, totalToquesEnviados] = await Promise.all([
    prisma.recoveryEntry.aggregate({
      where: { companyId, attributed: true, returnedAt: { gte: comecoDoMes } },
      _sum: { valueCents: true },
      _count: true,
    }),
    prisma.recoveryEntry.aggregate({
      where: { companyId, attributed: true },
      _sum: { valueCents: true },
      _count: true,
    }),
    // Conta TUDO, inclusive o que não entra no total: é o que decide se a tela
    // está vazia. Decidir pelas 200 linhas mostrava "R$ 0,00" em cima de uma
    // lista cheia de valores.
    prisma.recoveryEntry.count({ where: { companyId } }),
    prisma.recoveryEntry.findMany({
      where: { companyId },
      orderBy: { returnedAt: "desc" },
      take: LINHAS_NO_EXTRATO,
      select: {
        id: true,
        returnedAt: true,
        valueCents: true,
        daysAway: true,
        touchNumber: true,
        attributed: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.recoveryTouch.count({ where: { companyId, outcome: "AGUARDANDO" } }),
    prisma.recoveryTouch.count({ where: { companyId, outcome: { not: "PULADO" } } }),
  ]);

  const totalDoMesCents = mes._sum.valueCents ?? 0;
  const totalGeralCents = acumulado._sum.valueCents ?? 0;

  const data = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <main className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl text-panel-ink">Dinheiro recuperado</h1>
        <p className="mt-1 text-sm text-panel-sub">
          O dinheiro que voltou pro seu caixa. Só entra aqui o que voltou e pagou, marcado
          por você. Nada é chute.
        </p>
      </div>

      {totalDeEntradas === 0 ? (
        /* Vazio termina em AÇÃO, não em "nenhum dado". Regra Zero. */
        <div className="rounded-2xl border border-panel-line bg-panel-card p-6">
          <p className="font-display text-lg text-panel-ink">Ainda não voltou ninguém</p>
          <p className="mt-2 text-sm leading-relaxed text-panel-sub">
            {aguardando > 0
              ? `Você chamou ${aguardando} ${aguardando === 1 ? "pessoa" : "pessoas"} e ainda não disse se ${aguardando === 1 ? "ela apareceu" : "elas apareceram"}. Quando alguém voltar e pagar, marque na sua lista de segunda — é assim que este extrato enche.`
              : "Este extrato enche quando você chama os clientes sumidos na segunda e marca quem voltou. Sem isso ele fica vazio, e um número inventado aqui não serviria para nada."}
          </p>
          <Link
            href="/painel/onda"
            className="mt-4 inline-block rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-night transition hover:brightness-110"
          >
            Ver meus clientes sumidos
          </Link>
        </div>
      ) : (
        <>
          {/*
            O NÚMERO EM DESTAQUE.
            É o argumento inteiro da mensalidade num bloco só: quanto voltou
            desde sempre, e por quanto isso saiu. Some no banco — ver o
            comentário do topo.
          */}
          <section className="rounded-2xl border border-panel-line bg-panel-card p-6">
            <p className="text-xs uppercase tracking-[0.14em] text-panel-sub">
              Total recuperado pela Nexora
            </p>
            <p className="mt-2 font-display text-4xl font-bold text-panel-ink tabular-nums">
              {emReais(totalGeralCents)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-panel-sub">
              Dinheiro que voltou para o seu caixa sem você gastar 1 real a mais em anúncios.
            </p>

            {acumulado._count === 0 && (
              /* Tem linha no extrato e o total é zero: sem esta frase, a pior
                 primeira impressão possível do número que prova o produto. */
              <p className="mt-3 rounded-xl bg-panel-bg p-3 text-sm text-panel-ink">
                Os retornos abaixo aconteceram fora da janela em que dá para provar que foi a
                sua mensagem que trouxe a pessoa. Por isso eles aparecem na lista, mas não
                somam aqui em cima.
              </p>
            )}
          </section>

          {/*
            O MÊS CONTRA O QUE A NEXORA CUSTA NO MÊS.
            Substituiu os dois cartões que só repetiam números já mostrados
            acima e no extrato abaixo. O período é o mesmo dos dois lados de
            propósito — dividir o acumulado de sempre pela mensalidade de um mês
            faria o multiplicador crescer sozinho (lib/painel/retorno.ts).
          */}
          <CartaoRetorno
            retorno={retornoDaAssinatura({ recuperadoCents: totalDoMesCents })}
            totalCents={totalGeralCents}
          />

          {/* Mini-funil de Eficiência de Reativação */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-panel-line bg-panel-card p-4">
              <p className="text-xs uppercase tracking-wider text-panel-sub">Mensagens Enviadas</p>
              <p className="mt-1 font-display text-2xl font-bold text-panel-ink tabular-nums">{totalToquesEnviados}</p>
              <p className="text-xs text-panel-sub">mensagens disparadas</p>
            </div>
            <div className="rounded-2xl border border-panel-line bg-panel-card p-4">
              <p className="text-xs uppercase tracking-wider text-panel-sub">Clientes Resgatados</p>
              <p className="mt-1 font-display text-2xl font-bold text-emerald-400 tabular-nums">{acumulado._count}</p>
              <p className="text-xs text-panel-sub">voltaram e pagaram</p>
            </div>
            <div className="rounded-2xl border border-panel-line bg-panel-card p-4">
              <p className="text-xs uppercase tracking-wider text-panel-sub">Taxa de Conversão</p>
              <p className="mt-1 font-display text-2xl font-bold text-amber-deep tabular-nums">
                {totalToquesEnviados > 0 ? `${Math.round((acumulado._count / totalToquesEnviados) * 100)}%` : "—"}
              </p>
              <p className="text-xs text-panel-sub">dos clientes chamados</p>
            </div>
          </div>

          <div className="rounded-2xl border border-panel-line bg-panel-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-line px-5 py-4">
              <h2 className="font-display font-semibold text-panel-ink">Quem voltou</h2>
              <a
                href="/api/livro-caixa?formato=csv"
                className="text-sm font-semibold text-amber-deep underline underline-offset-4"
              >
                Baixar em planilha
              </a>
            </div>

            <ul className="divide-y divide-panel-line">
              {extrato.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3.5">
                  <span className="font-mono text-xs text-panel-sub">{data.format(e.returnedAt)}</span>
                  <span className="font-medium text-panel-ink">
                    {e.customer?.name ?? "cliente que você apagou"}
                  </span>
                  <span className="text-xs text-panel-sub">
                    sumido há {e.daysAway} dias · voltou na {e.touchNumber}ª mensagem
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    {e.attributed && (
                      <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 sm:inline-block">
                        Recuperado ✓
                      </span>
                    )}
                    <span className="font-display font-semibold text-panel-ink">
                      {emReais(e.valueCents)}
                    </span>
                  </div>
                  {!e.attributed && (
                    /* Voltou fora da janela em que dá para provar a causa. Fica
                       no extrato e NÃO entra no total — inflar o número é a
                       forma mais rápida de o dono parar de confiar nele. */
                    <span className="w-full text-xs text-panel-sub">
                      voltou, mas não dá para provar que foi pela sua mensagem — por isso não
                      somei no total
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {totalDeEntradas > extrato.length && (
              <p className="border-t border-panel-line px-5 py-3 text-xs text-panel-sub">
                Mostrando os {extrato.length} retornos mais recentes de {totalDeEntradas}. Os
                totais lá em cima contam todos.
              </p>
            )}
          </div>

          {aguardando > 0 && (
            <div className="rounded-2xl border border-panel-line bg-panel-bg p-5">
              <p className="text-sm text-panel-ink">
                Você chamou{" "}
                <strong className="font-semibold">
                  {aguardando} {aguardando === 1 ? "pessoa" : "pessoas"}
                </strong>{" "}
                e ainda não disse se {aguardando === 1 ? "ela apareceu" : "elas apareceram"}. Se
                alguma voltou, o dinheiro dela ainda não está contado aqui.
              </p>
              <Link
                href="/painel/onda"
                className="mt-3 inline-block rounded-xl border border-panel-line px-4 py-2.5 text-sm font-semibold transition hover:border-amber"
              >
                Dizer quem apareceu
              </Link>
            </div>
          )}
        </>
      )}
    </main>
  );
}
