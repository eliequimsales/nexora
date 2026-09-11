import { emReais, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { custoVsRetorno } from "@/lib/recuperacao/custo-vs-retorno";
import { JANELA_DIAS } from "@/lib/recuperacao/estimativa";

/**
 * O QUE A NEXORA CUSTA VS. O QUE ELA TRAZ.
 *
 * Aparece só no resultado que recomenda comprar — fora do corte honesto e com
 * valor na lista —, antes do botão de criar conta. A conta mora em
 * lib/recuperacao/custo-vs-retorno.ts; aqui nenhum número é escrito à mão.
 */
export function CustoVsRetorno({
  min,
  max,
  confianca,
}: {
  min: number;
  max: number;
  confianca: "alta" | "baixa";
}) {
  const c = custoVsRetorno({ min, max });
  const vezes = c.vezesNoMinimo.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const gratis =
    c.mesesGratis === 0
      ? ""
      : c.mesesGratis === 1
        ? " — o primeiro mês é grátis"
        : ` — os ${c.mesesGratis} primeiros meses são grátis`;

  return (
    <div className="mt-6 rounded-xl border border-nx-gold/30 bg-nx-gold/5 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-nx-gold">
        O que a Nexora custa vs. o que ela traz
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-nx-muted">Custo nos próximos {JANELA_DIAS} dias</p>
          <p className="mt-1 text-2xl font-bold">{emReais(c.custoCents)}</p>
          <p className="mt-1 text-xs leading-relaxed text-nx-muted">
            {c.mesesPagos} {c.mesesPagos === 1 ? "mensalidade" : "mensalidades"} de{" "}
            {emReais(PRECO_MENSAL_CENTS)}
            {gratis}
          </p>
        </div>
        <div>
          <p className="text-xs text-nx-muted">Retorno estimado nos mesmos {JANELA_DIAS} dias</p>
          <p className="mt-1 text-2xl font-bold text-nx-success">
            {emReais(min)} a {emReais(max)}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-nx-muted">
            a faixa acima, calculada com a sua lista
          </p>
        </div>
      </div>

      <p className="mt-4 border-t border-nx-border pt-4 text-sm leading-relaxed text-nx-secondary">
        {c.cobreNoMinimo ? (
          <>
            No cenário mais baixo, o que volta é{" "}
            <strong className="text-nx-primary">
              {vezes} {c.vezesNoMinimo === 1 ? "vez" : "vezes"}
            </strong>{" "}
            o que a Nexora custa no período.
          </>
        ) : (
          "No cenário mais baixo, o que volta não cobre o que a Nexora custa no período."
        )}
        {confianca === "baixa" && " A confiança desta estimativa é baixa — o motivo está logo acima."}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-nx-muted">
        É estimativa, não garantia: o retorno depende de as mensagens saírem e de quem responder.
      </p>
    </div>
  );
}
