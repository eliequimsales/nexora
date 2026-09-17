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
  return (
    <section className="rounded-2xl border border-panel-line bg-panel-card p-6">
      <p className="text-xs uppercase tracking-[0.14em] text-panel-sub">
        O que a Nexora trouxe este mês
      </p>
      <p className="mt-2 font-display text-4xl font-bold tabular-nums text-panel-ink">
        {emReais(retorno.recuperadoCents)}
      </p>
      <p className="mt-1 text-sm text-panel-sub">
        voltou para o seu caixa este mês, marcado por você
      </p>

      {retorno.multiplicador === null ? (
        <div className="mt-4 rounded-xl bg-amber/15 p-4">
          <p className="text-sm leading-relaxed text-panel-ink">{retorno.educativo}</p>
          <Link
            href="/painel/onda"
            className="mt-3 inline-flex rounded-xl bg-amber px-4 py-2.5 text-sm font-semibold text-night transition hover:brightness-110"
          >
            Ver quem sumiu
          </Link>
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-panel-bg p-4 font-display text-lg font-semibold text-amber-deep">
          {retorno.texto}
        </p>
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
