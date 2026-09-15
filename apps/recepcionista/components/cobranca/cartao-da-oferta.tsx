import Link from "next/link";
import { textosDaOferta, type Oferta } from "@/lib/billing/oferta";

/**
 * O CARTÃO DA OFERTA — o que aparece onde a ação trava.
 *
 * Todo texto sai de textosDaOferta: nenhum número é escrito aqui. Abaixo do
 * Corte Honesto o cartão não empurra o plano; mostra a recomendação honesta e o
 * caminho útil de verdade, que é trazer mais clientes para a lista.
 *
 * Sem oferta (o cálculo falhou, ou o estado não é de quem ainda escolhe plano),
 * cai no motivo e na ação que a recusa já trazia — a Regra Zero continua valendo.
 */
export function CartaoDaOferta({
  motivo,
  acao,
  oferta,
}: {
  motivo: string;
  acao: { texto: string; href: string };
  oferta: Oferta | null;
}) {
  if (!oferta) {
    return (
      <div className="rounded-2xl border border-amber/40 bg-amber/10 p-6">
        <p className="text-panel-ink">{motivo}</p>
        <Link
          href={acao.href}
          className="mt-4 inline-flex rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-night transition hover:brightness-110"
        >
          {acao.texto}
        </Link>
      </div>
    );
  }

  const t = textosDaOferta(oferta);

  return (
    <section
      className="rounded-2xl border border-amber/40 bg-panel-card p-6 shadow-sm"
      aria-labelledby="oferta-titulo"
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-deep">
        {t.recomendaNaoAssinar ? "Recomendação honesta" : "O que a sua lista mostra"}
      </p>
      <h2 id="oferta-titulo" className="mt-2 font-display text-xl text-panel-ink">
        {t.titulo}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-panel-sub">{t.prova}</p>

      {oferta.previa.length > 0 && !t.recomendaNaoAssinar && (
        <ul className="mt-4 grid gap-2" aria-label="Alguns dos clientes fora do ritmo">
          {oferta.previa.map((p, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-lg border border-panel-line bg-panel-bg px-3 py-2 text-sm"
            >
              <span className="font-medium text-panel-ink">{p.iniciais}</span>
              <span className="tabular-nums text-panel-sub">{p.diasSemVir} dias sem vir</span>
            </li>
          ))}
        </ul>
      )}

      {t.ancora && (
        <p className="mt-4 rounded-xl bg-amber/15 p-3 text-sm text-panel-ink">{t.ancora}</p>
      )}

      {t.recomendaNaoAssinar ? (
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Link
            href="/painel/clientes/importar"
            className="rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-night transition hover:brightness-110"
          >
            Adicionar mais clientes à lista
          </Link>
          <Link href={acao.href} className="text-sm text-panel-sub underline underline-offset-4">
            Ver os planos mesmo assim
          </Link>
        </div>
      ) : (
        <Link
          href={acao.href}
          className="mt-5 inline-flex rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-night transition hover:brightness-110"
        >
          {acao.texto}
        </Link>
      )}

      <p className="mt-4 text-xs text-panel-sub">
        Sua lista continua sua: ver e exportar é sempre grátis, com ou sem plano.
      </p>
    </section>
  );
}
