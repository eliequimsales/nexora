import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { emReais } from "@/lib/billing/preco";

export const dynamic = "force-dynamic";

/**
 * LIVRO-CAIXA DA RECUPERAÇÃO — a prova de que a Nexora vale o que cobra.
 *
 * A rota /api/livro-caixa estava completa há tempos — mês, acumulado, extrato,
 * coluna sem atribuição, exportação em CSV — e NENHUMA página a consumia. O
 * único lugar onde o dono via quanto recuperou era /painel/assinatura.
 *
 * Ou seja: a prova de que vale R$ 97 morava atrás do botão de cancelar. Ele só
 * encontrava o argumento para ficar no exato momento em que já tinha decidido
 * sair. Isso não é detalhe de navegação — é a North Star escondida do dono.
 *
 * Server Component, consultando direto: a rota continua existindo para o CSV e
 * para quem quiser os dados crus, mas a tela não precisa de ida e volta.
 *
 * SEM GRÁFICO, de propósito. O Artigo X proíbe dashboard de vaidade: aqui é
 * extrato, cada linha é um retorno que aconteceu, e o número é conferível
 * contra o caixa dele.
 */
export default async function LivroCaixaPage() {
  const companyId = await getSessionCompanyId();
  if (!companyId) redirect("/login");

  const entradas = await prisma.recoveryEntry.findMany({
    where: { companyId },
    orderBy: { returnedAt: "desc" },
    take: 200,
    select: {
      id: true,
      returnedAt: true,
      valueCents: true,
      daysAway: true,
      esteira: true,
      touchNumber: true,
      attributed: true,
      customer: { select: { name: true } },
    },
  });

  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);

  const comprovadas = entradas.filter((e) => e.attributed);
  const doMes = comprovadas.filter((e) => e.returnedAt >= inicioDoMes);
  const soma = (lista: typeof entradas) => lista.reduce((s, e) => s + e.valueCents, 0);

  const aguardando = await prisma.recoveryTouch.count({
    where: { companyId, outcome: "AGUARDANDO" },
  });

  const data = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <main className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl text-panel-ink">Livro-Caixa da Recuperação</h1>
        <p className="mt-1 text-sm text-panel-sub">
          Só entra aqui o que voltou e pagou, marcado por você. Nada é estimado.
        </p>
      </div>

      {entradas.length === 0 ? (
        /* Vazio termina em AÇÃO, não em "nenhum dado". Regra Zero. */
        <div className="rounded-2xl border border-panel-line bg-panel-card p-6">
          <p className="font-display text-lg text-panel-ink">Ainda não voltou ninguém</p>
          <p className="mt-2 text-sm leading-relaxed text-panel-sub">
            {aguardando > 0
              ? `Você tem ${aguardando} ${aguardando === 1 ? "pessoa" : "pessoas"} que receberam mensagem e ainda não responderam. Quando alguém aparecer e pagar, marque na Onda — é assim que este extrato enche.`
              : "Este extrato enche quando você manda a Onda da semana e marca quem voltou. Sem isso ele fica vazio, e um número inventado aqui não serviria para nada."}
          </p>
          <Link
            href="/painel/onda"
            className="mt-4 inline-block rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-night transition hover:brightness-110"
          >
            Ir para a Onda de segunda
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-panel-line bg-panel-card p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-panel-sub">Este mês</p>
              <p className="mt-2 font-display text-3xl font-bold text-panel-ink">
                {emReais(soma(doMes))}
              </p>
              <p className="mt-1 text-sm text-panel-sub">
                {doMes.length} {doMes.length === 1 ? "cliente voltou" : "clientes voltaram"}
              </p>
            </div>

            <div className="rounded-2xl border border-panel-line bg-panel-card p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-panel-sub">
                Desde que você começou
              </p>
              <p className="mt-2 font-display text-3xl font-bold text-panel-ink">
                {emReais(soma(comprovadas))}
              </p>
              <p className="mt-1 text-sm text-panel-sub">
                {comprovadas.length}{" "}
                {comprovadas.length === 1 ? "cliente recuperado" : "clientes recuperados"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-panel-line bg-panel-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-line px-5 py-4">
              <h2 className="font-display font-semibold text-panel-ink">Extrato</h2>
              <a
                href="/api/livro-caixa?formato=csv"
                className="text-sm font-semibold text-amber-deep underline underline-offset-4"
              >
                Baixar em planilha
              </a>
            </div>

            <ul className="divide-y divide-panel-line">
              {entradas.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3.5">
                  <span className="font-mono text-xs text-panel-sub">{data.format(e.returnedAt)}</span>
                  <span className="font-medium text-panel-ink">
                    {e.customer?.name ?? "cliente excluído"}
                  </span>
                  <span className="text-xs text-panel-sub">
                    sumido há {e.daysAway} dias · toque {e.touchNumber}
                  </span>
                  <span className="ml-auto font-display font-semibold text-panel-ink">
                    {emReais(e.valueCents)}
                  </span>
                  {!e.attributed && (
                    /* Voltou, mas fora da janela de atribuição. Fica no extrato
                       e NÃO entra no total — inflar o número é a forma mais
                       rápida de o dono parar de confiar nele. */
                    <span className="w-full text-xs text-panel-sub">
                      voltou sem atribuição — não somei no total acima
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {aguardando > 0 && (
            <div className="rounded-2xl border border-panel-line bg-panel-bg p-5">
              <p className="text-sm text-panel-ink">
                <strong className="font-semibold">
                  {aguardando} {aguardando === 1 ? "pessoa" : "pessoas"}
                </strong>{" "}
                receberam mensagem e ainda não têm desfecho marcado. Se alguma apareceu, o
                dinheiro dela ainda não está contado aqui.
              </p>
              <Link
                href="/painel/onda"
                className="mt-3 inline-block rounded-xl border border-panel-line px-4 py-2.5 text-sm font-semibold transition hover:border-amber"
              >
                Marcar quem apareceu
              </Link>
            </div>
          )}
        </>
      )}
    </main>
  );
}
