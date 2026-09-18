import Link from "next/link";
import { emReais } from "@/lib/billing/preco";
import type { Retorno } from "@/lib/painel/retorno";

/**
 * O CARTÃO QUE COMPARA O QUE VOLTOU COM O QUE CUSTA.
 *
 * Mesmo período dos dois lados — o mês contra a mensalidade do mês. O acumulado
 * aparece em reais, nunca como múltiplo: dividir o recuperado de sempre pela
 * mensalidade de um mês faria o número crescer sozinho (lib/painel/retorno.ts).
 *
 * Sem retorno no mês, o cartão termina em ação em vez de exibir um zero seco.
 */

export function CartaoRetorno({
  retorno,
  totalCents = null,
}: {
  retorno: Retorno;
  /** Tudo que já voltou, desde o começo. Opcional: nem toda tela tem. */
  totalCents?: number | null;
}) {
  const lucroLiquidoCents = retorno.recuperadoCents - retorno.custoCents;
  const porcentagemMeta = Math.min(100, Math.round((retorno.recuperadoCents / retorno.custoCents) * 100));

  return (
    <section className="rounded-2xl border border-panel-line bg-panel-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.14em] text-panel-sub">
          O que a Nexora trouxe este mês
        </p>
        {retorno.cobre && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Assinatura Paga
          </span>
        )}
      </div>

      <p className="mt-2 font-display text-4xl font-bold tabular-nums text-panel-ink">
        {emReais(retorno.recuperadoCents)}
      </p>
      <p className="mt-1 text-sm text-panel-sub">
        voltou para o seu caixa este mês, marcado por você
      </p>

      {retorno.cobre ? (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-display text-base font-bold text-emerald-400 sm:text-lg">
              {retorno.multiplicador && retorno.multiplicador > 1
                ? `⚡ A Nexora já se pagou ${retorno.multiplicador.toFixed(1).replace(".", ",")}x este mês!`
                : "⚡ A Nexora já se pagou este mês!"}
            </p>
            {lucroLiquidoCents > 0 && (
              <span className="font-mono text-xs font-semibold text-emerald-300">
                +{emReais(lucroLiquidoCents)} lucro
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-panel-sub sm:text-sm">
            Você investiu {emReais(retorno.custoCents)} na assinatura e resgatou {emReais(retorno.recuperadoCents)} direto para o seu caixa.
          </p>
        </div>
      ) : retorno.multiplicador === null ? (
        <div className="mt-4 rounded-xl bg-amber/15 p-4">
          <p className="text-sm leading-relaxed text-panel-ink">{retorno.educativo}</p>
          <div className="mt-3 flex items-center justify-between text-xs text-panel-sub">
            <span>Meta da assinatura: {emReais(retorno.custoCents)}</span>
            <span className="font-medium text-amber-deep">Faltam {emReais(retorno.custoCents - retorno.recuperadoCents)}</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-panel-line">
            <div
              className="h-full bg-amber transition-all"
              style={{ width: `${porcentagemMeta}%` }}
            />
          </div>
          <Link
            href="/painel/onda"
            className="mt-3 inline-flex rounded-xl bg-amber px-4 py-2.5 text-sm font-semibold text-night transition hover:brightness-110"
          >
            Ver quem sumiu
          </Link>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-panel-bg p-4">
          <p className="font-display text-base font-semibold text-amber-deep">
            {retorno.texto}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-panel-sub">
            <span>Progresso da mensalidade ({porcentagemMeta}%)</span>
            <span>Faltam {emReais(retorno.custoCents - retorno.recuperadoCents)}</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-panel-line">
            <div
              className="h-full bg-amber transition-all"
              style={{ width: `${porcentagemMeta}%` }}
            />
          </div>
        </div>
      )}

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex items-baseline justify-between gap-2 sm:block">
          <dt className="text-panel-sub">O que a Nexora custa no mês</dt>
          <dd className="font-semibold tabular-nums text-panel-ink sm:mt-1">
            {emReais(retorno.custoCents)}
          </dd>
        </div>
        {typeof totalCents === "number" && (
          <div className="flex items-baseline justify-between gap-2 sm:block">
            <dt className="text-panel-sub">Desde que você começou</dt>
            <dd className="font-semibold tabular-nums text-panel-ink sm:mt-1">
              {emReais(totalCents)}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
