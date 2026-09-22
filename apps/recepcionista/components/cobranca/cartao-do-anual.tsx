import type { OfertaDoAnual } from "@/lib/billing/anual-na-prova";

/**
 * O ANUAL NO MOMENTO DA PROVA.
 *
 * Todo texto sai de ofertaDoAnual: nenhum número é escrito aqui. O botão abre o
 * suporte em outra aba quando a troca é pelo WhatsApp ou pelo e-mail.
 */
export function CartaoDoAnual({ oferta }: { oferta: OfertaDoAnual }) {
  const externo = /^(https?:|mailto:)/.test(oferta.acao.href);
  return (
    <section
      className="rounded-2xl border border-amber/40 bg-panel-card p-6 shadow-sm"
      aria-labelledby="anual-titulo"
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-deep">
        A prova está no seu caixa
      </p>
      <h2 id="anual-titulo" className="mt-2 font-display text-lg text-panel-ink">
        {oferta.titulo}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-panel-sub">{oferta.texto}</p>
      <a
        href={oferta.acao.href}
        {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="mt-4 inline-flex rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-night transition hover:brightness-110"
      >
        {oferta.acao.texto}
      </a>
    </section>
  );
}
