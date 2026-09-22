import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { emReais } from "@/lib/billing/preco";
import { anualDaEmpresa } from "@/lib/billing/anual-da-conta";
import { estadoDaEmpresa } from "@/lib/billing/guarda";
import { CartaoDoAnual } from "@/components/cobranca/cartao-do-anual";
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
      where: { companyId, returnedAt: { gte: comecoDoMes }, attributed: true },
      _sum: { valueCents: true },
      _count: true,
    }),
    prisma.recoveryEntry.aggregate({
      where: { companyId, attributed: true },
      _sum: { valueCents: true },
      _count: true,
    }),
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

  // A prova aparece aqui primeiro: é a tela do dinheiro. Falha no cálculo não
  // derruba o extrato.
  const anual = await estadoDaEmpresa(companyId)
    .then((estado) => anualDaEmpresa(companyId, estado))
    .catch(() => null);

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
          O dinheiro que voltou pro seu caixa sem você gastar 1 real a mais em anúncios. Só entra aqui o que voltou e pagou, marcado por você.
        </p>
      </div>

      {totalDeEntradas === 0 ? (
        /* Vazio termina em AÇÃO, não em "nenhum dado". Regra Zero. */
        <div className="rounded-2xl border border-panel-line bg-panel-card p-6">
          <p className="font-display text-lg text-panel-ink">Ainda não voltou ninguém</p>
          <p className="mt-2 text-sm leading-relaxed text-panel-sub">
            {aguardando > 0
              ? `Você chamou ${aguardando} ${aguardando === 1 ? "pessoa" : "pessoas"} e ainda não disse se ${aguardando === 1 ? "ela apareceu" : "elas apareceram"}. Quando alguém voltar e pagar, marque na sua lista de reativação — é assim que este extrato enche.`
              : "Este extrato enche quando você chama os clientes sumidos e marca quem voltou. Sem isso ele fica vazio, e um número inventado aqui não serviria para nada."}
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
          {/* Cartão de Retorno do Mês comparado com a mensalidade e total acumulado */}
          <CartaoRetorno
            retorno={retornoDaAssinatura({ recuperadoCents: totalDoMesCents })}
            totalCents={totalGeralCents}
          />

          {/* O anual no momento da prova: acima de três mensalidades em 30 dias. */}
          {anual && <CartaoDoAnual oferta={anual} />}

          {/* Métricas de Reativação */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-panel-line bg-panel-card p-4">
              <p className="text-xs uppercase tracking-wider text-panel-sub font-medium">Mensagens Enviadas</p>
              <p className="mt-1 font-display text-2xl font-bold text-panel-ink tabular-nums">{totalToquesEnviados}</p>
              <p className="text-xs text-panel-sub">mensagens enviadas</p>
            </div>
            <div className="rounded-2xl border border-panel-line bg-panel-card p-4">
              <p className="text-xs uppercase tracking-wider text-panel-sub font-medium">Clientes Resgatados</p>
              <p className="mt-1 font-display text-2xl font-bold text-emerald-600 tabular-nums">{acumulado._count}</p>
              <p className="text-xs text-panel-sub">voltaram e pagaram</p>
            </div>
            <div className="rounded-2xl border border-panel-line bg-panel-card p-4">
              <p className="text-xs uppercase tracking-wider text-panel-sub font-medium">Taxa de Conversão</p>
              <p className="mt-1 font-display text-2xl font-bold text-amber-deep tabular-nums">
                {totalToquesEnviados > 0 ? `${Math.round((acumulado._count / totalToquesEnviados) * 100)}%` : "—"}
              </p>
              <p className="text-xs text-panel-sub">dos clientes chamados</p>
            </div>
          </div>

          {/* Extrato Quem Voltou */}
          <div className="rounded-2xl border border-panel-line bg-panel-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-line px-5 py-4">
              <div>
                <h2 className="font-display font-semibold text-panel-ink">Quem voltou</h2>
                <p className="text-xs text-panel-sub mt-0.5">Clientes que retornaram e pagaram após o contato</p>
              </div>
              <a
                href="/api/livro-caixa?formato=csv"
                className="text-xs font-semibold text-panel-sub hover:text-panel-ink underline underline-offset-4 transition"
              >
                Baixar em planilha
              </a>
            </div>

            <ul className="divide-y divide-panel-line">
              {extrato.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-panel-sub">{data.format(e.returnedAt)}</span>
                    <div>
                      <p className="font-medium text-sm text-panel-ink">
                        {e.customer?.name ?? "Cliente apagado"}
                      </p>
                      <p className="text-xs text-panel-sub">
                        sumido há {e.daysAway} dias · voltou na {e.touchNumber}ª mensagem
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {e.attributed && (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        Recuperado ✓
                      </span>
                    )}
                    <span className="font-display font-bold text-base text-panel-ink">
                      {emReais(e.valueCents)}
                    </span>
                  </div>
                  {!e.attributed && (
                    <span className="w-full text-xs text-panel-sub">
                      voltou, mas não dá para provar que foi pela sua mensagem — por isso não somei no total
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {totalDeEntradas > extrato.length && (
              <p className="border-t border-panel-line px-5 py-3 text-xs text-panel-sub">
                Mostrando os {extrato.length} retornos mais recentes de {totalDeEntradas}.
              </p>
            )}
          </div>

          {aguardando > 0 && (
            <div className="rounded-2xl border border-panel-line bg-panel-bg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-panel-ink">
                  Você chamou {aguardando} {aguardando === 1 ? "pessoa" : "pessoas"} recentemente
                </p>
                <p className="text-xs text-panel-sub mt-0.5">
                  Se alguma já voltou, marque na lista para somar o valor no seu caixa.
                </p>
              </div>
              <Link
                href="/painel/onda"
                className="rounded-xl border border-panel-line bg-white hover:border-amber px-4 py-2 text-xs font-semibold text-panel-ink transition shrink-0 self-start sm:self-center"
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
